# TUI Plugin - Technical Reference

**Plugin Type**: TUI (OpenCode v2 plugin API)
**Entry Point**: `oclitellmac/tui` (built to `dist/tui.js`)

## Overview

The TUI plugin shows budget and usage information from LiteLLM proxies in the OpenCode sidebar. It is a **pure consumer** of files written by the server plugin and makes no network calls.

When registering the plugin or understanding how the TUI entry is loaded, [read here](../docs/opencode-plugin-cli.md)

When looking for the budget file producer side, [read here](../server/README.md)

## Module Structure

```
plugins/oclitellmac/tui/src/
├── index.tsx              # Plugin module (id + setup), slot claim, wiring
├── paths.ts               # State/budget/log/config paths (xdg-basedir)
├── config.ts              # Reads options.tui from server.json
├── log.ts                 # Leveled, size-rotated file logger
├── types.ts               # KeyInfoFile, ProviderBudget, BudgetData
├── loader.ts              # BudgetLoader: reads and validates budget files
├── reloader.ts            # Serialized, change-aware reloading
├── watcher.ts             # BudgetWatcher: debounced fs.watch with polling fallback
├── view.ts                # Sidebar modes: which budgets to show
├── components/
│   ├── KeyInfoPanel.tsx   # Sidebar panel (container)
│   └── ProviderCard.tsx   # One card per provider
└── utils/
    └── format.ts          # Currency, percent, progress bar, time formatting
```

## Plugin Shape

`index.tsx` default-exports a `Plugin.Definition` (type from `@opencode/plugin/tui`):

```typescript
const plugin: Plugin.Definition = { id: 'oclitellmac.tui', setup }
export default plugin
```

`setup(ctx)` does the following:

1. Reads `options.tui` from the plugin config (`loadTuiSettings()`), then creates a `Logger` (`getLogDir()`, id `tui`, level from the config) and a `BudgetLoader`.
2. Holds `budgetData` and `loadStatus` in Solid signals, fed by a `Reloader` around `loadAll()`.
3. Stores the sidebar mode with `ctx.storage.store('sidebar', ...)` (durable, shared by all TUI windows) and registers the `/budget` command with `ctx.keymap.layer`.
4. Starts a `BudgetWatcher` on the state directory; each settled burst of changes requests a reload.
5. Claims a sidebar slot with `ctx.ui.slot({ append: 'sidebar.content', render })`. `render` receives `{ sessionID }` and returns `<KeyInfoPanel>` with the mode and the provider of the selected model (`ctx.ui.model.current()`).
6. Returns a cleanup function that stops the watcher and the reloader and closes the logger.

Colors come from the resolved theme tokens on `ctx.theme` (`text.base`, `text.muted`, `border.base`, `text.feedback.{error,warning,success}.base`).

## Data Flow

```
server plugin writes ~/.local/state/oclitellmac/key-info/<providerKey>.json
  -> BudgetWatcher fires onChange once the burst of events has settled (fs.watch, or polling until fs.watch works)
  -> Reloader runs one BudgetLoader.loadAll() at a time and collapses requests that arrive meanwhile
  -> signals budgetData / loadStatus update, only if the loaded content changed
  -> KeyInfoPanel re-renders for the selected sidebar mode
```

The TUI never writes budget files.

## Module Reference

### `paths.ts`

- `getStateDir()`: `<XDG state>/oclitellmac` (default `~/.local/state/oclitellmac`); throws if no state directory can be determined
- `getBudgetDataDir()`: `<state>/key-info`
- `getLogDir()`: `<state>/log`
- `getConfigPath()`: `<XDG config>/oclitellmac/server.json`

When working on path conventions, [read here](../docs/PATH-STRATEGY.md)

### `config.ts`

`loadTuiSettings(configPath?)` reads `options.tui.logLevel` and `options.tui.sidebarMode` from `server.json` once at setup. A missing or invalid file or value yields the defaults (`warn`, `current`) and never throws. For the fields, when changing or adding settings, [read here](../docs/CONFIGURATION.md)

### `log.ts`

`Logger(logBaseDirectory, id, { level, maxBytes, maxFiles })` drops messages below `level` (default `warn`). It creates `<logBaseDirectory>/<id>/YYYY-MM-DD-HH-mm-ss.log` (for the TUI: `~/.local/state/oclitellmac/log/tui/`) on the first message that passes the filter, so an idle plugin creates no file. The file is appended to for the session, replaced by a new one after 1 MiB, and only the newest 5 timestamp-named files are kept. It falls back to `console.error` if a write or open fails. `close()` releases the file descriptor.

### `types.ts`

- `KeyInfoFile`: raw file written by the server (`providerKey`, optional `providerName`, `fetchedAt` as ms timestamp, `keyInfo.key`, `keyInfo.info.*` with LiteLLM `/key/info` fields such as `key_alias`, `spend`, `max_budget`, `budget_duration`, `budget_reset_at`, `expires`)
- `ProviderBudget`: normalized display structure (`providerKey`, `providerName`, `keyAlias`, `spend`, `limit`, `remaining`, `percentUsed`, `duration`, `resetAt`, `expiresAt`, `lastFetched`)
- `BudgetData`: `Record<providerKey, ProviderBudget>`

### `loader.ts`

- `loadAll()` returns `{ budgets, hasErrors, errorCount }`. It reads every `*.json` in the budget directory concurrently; files that fail validation are counted as errors and skipped. Budgets are ordered by provider name, then key. A missing directory yields empty budgets without errors.
- `loadOne(providerKey)` requires `keyInfo.info.spend` to be a number and `max_budget`, when present, to be a number or null; otherwise it returns `null`. A missing, null or zero `max_budget` means no limit: `limit`, `remaining` and `percentUsed` are `null`. `key_alias` falls back to `'Unknown'` and `expires` to `'Never'`; `budget_duration` and `budget_reset_at` stay `null` when unknown.
- Provider name is `providerName` from the file, else the key split on `-` with each part capitalized (`litellm-prod` becomes `Litellm Prod`).
- An invalid file is logged once per distinct problem, not on every reload.

### `reloader.ts`

`Reloader(load, apply, onError)`: at most one load is in flight, and requests arriving meanwhile collapse into exactly one more load afterwards, so a slow older load cannot overwrite newer data. `apply` runs only when the loaded value differs (by JSON) from the last applied one. `stop()` ends it.

### `watcher.ts`

`BudgetWatcher(stateDir, onChange, logger, pollInterval = 5000, debounceMs = 150)`:

- `start()` calls `fs.watch(<stateDir>/key-info, { recursive: false })` and, for events on `*.json` files, calls `onChange` once the burst has settled (trailing debounce).
- If `fs.watch` is unavailable (for example the directory does not exist yet) or fails later, the directory is polled every 5 s and every poll retries `fs.watch`; the first success ends the polling. Watching and polling are never active together.
- `stop()` is idempotent and leaves no timer behind.

### `view.ts`

Pure logic without JSX. `parseMode(text)` parses a mode name, `selectBudgets(mode, budgets, providerID)` returns the budgets to render (`all`: every budget; `current` and `masked`: only the provider of the selected model; `hidden`: none), and `showsHeader(mode)` says whether the "Key Info" header is shown.

### `components/KeyInfoPanel.tsx`

Props: `context: Plugin.Context`, `budgetData: BudgetData`, `loadStatus: { hasErrors, errorCount }`, `mode: SidebarMode`, `providerID` (provider of the selected model).

In `hidden` mode it renders one muted line, "Budget hidden (/budget)". Otherwise it renders a "Key Info" header (`all` and `current` only) and, per state:

- no budget for the selected model (`current`, `masked`): "No budget for the selected model"
- `all`, no budgets and errors: "Budget data parsing error (N file(s))" plus "Check logs for details"
- `all`, no budgets and no errors: "No budget data available" plus "Waiting for oclitellmac-server..."
- otherwise: one `ProviderCard` per selected budget

### `components/ProviderCard.tsx`

Props: `budget: ProviderBudget`, `theme: Plugin.Context['theme']`, `masked?: boolean`.

Shows, in a rounded-border box: provider name, text progress bar, `$spend / $limit`, percent used, remaining, reset (`Resets <relative> (<duration>)`, omitted when unknown), and an absolute locale-formatted fetch time. Without a limit it shows the spend and "No budget limit" instead. In `masked` mode it shows only the progress bar and percent (or "No budget limit"), with no name, amounts or dates. Progress bar and percentage are colored by usage:

- below 75%: success token
- 75% to below 90%: warning token
- 90% and above: error token

### `utils/format.ts`

Exports `formatCurrency` (USD, 2 decimals), `formatPercent` (1 decimal), `formatProgressBar` (20 chars of `█`/`░`), `formatDate`, `formatRelativeTime`, `formatSmartTime`, `formatAbsoluteTimeISO`, `formatAbsoluteTimeLocale`. The card uses currency, percent, progress bar, relative time and locale time; the others are currently unused by components.

## Sidebar Modes and the `/budget` Command

The sidebar shows `current` (default), `all`, `hidden` or `masked`; `view.ts` and `components/` implement them. The `/budget` command (palette entry "Budget display", id `oclitellmac.budget`) opens a list of the modes, and `/budget <mode>` sets one directly; an unknown name shows an error toast. The choice is kept in the plugin storage under the key `sidebar`, shared by all TUI windows, and wins over `options.tui.sidebarMode` once set. To switch it off entirely, disable the plugin in the Plugins dialog or add `"-oclitellmac.tui"` to `plugins` in `cli.json`.

## Logging

The TUI logs through its own file logger (see `log.ts` above), at `warn` unless `options.tui.logLevel` says otherwise. The server plugin has a separate log; for its location, [read here](../server/README.md)

## Related Documentation

- When looking for installation and configuration, [read here](../README.md)
- When looking for the budget file producer, [read here](../server/README.md)
- When building or testing the plugin, [read here](../docs/DEVELOPMENT.md)
