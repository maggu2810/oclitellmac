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
├── paths.ts               # State/budget/log directories (xdg-basedir)
├── log.ts                 # File-based logger
├── types.ts               # KeyInfoFile, ProviderBudget, BudgetData
├── loader.ts              # BudgetLoader: reads and validates budget files
├── watcher.ts             # BudgetWatcher: fs.watch with polling fallback
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

1. Creates a `Logger` (`getLogDir()`, id `tui`) and a `BudgetLoader`.
2. Holds `budgetData` and `loadStatus` in Solid signals and runs an initial `loadAll()`.
3. Starts a `BudgetWatcher` on the state directory; each change triggers a reload.
4. Claims a sidebar slot with `ctx.ui.slot({ append: 'sidebar.content', render })`. `render` receives `{ sessionID }` and returns `<KeyInfoPanel>`.
5. Returns a cleanup function that stops the watcher and closes the logger.

Colors come from the resolved theme tokens on `ctx.theme` (`text.base`, `text.muted`, `border.base`, `text.feedback.{error,warning,success}.base`).

## Data Flow

```
server plugin writes ~/.local/state/oclitellmac/key-info/<providerKey>.json
  -> BudgetWatcher fires onChange (fs.watch, or 5s polling fallback)
  -> BudgetLoader.loadAll() reads and validates every *.json
  -> signals budgetData / loadStatus update
  -> KeyInfoPanel re-renders
```

The TUI never writes budget files.

## Module Reference

### `paths.ts`

- `getStateDir()`: `<XDG state>/oclitellmac` (default `~/.local/state/oclitellmac`); throws if no state directory can be determined
- `getBudgetDataDir()`: `<state>/key-info`
- `getLogDir()`: `<state>/log`

When working on path conventions, [read here](../docs/PATH-STRATEGY.md)

### `log.ts`

`Logger(logBaseDirectory, id, rotateEvery = 500)` writes `<logBaseDirectory>/<id>/YYYY-MM-DD-HH-mm-ss.log` (for the TUI: `~/.local/state/oclitellmac/log/tui/`), starts a new file every 500 calls, and falls back to `console.error` if a write or open fails. `close()` releases the file descriptor.

### `types.ts`

- `KeyInfoFile`: raw file written by the server (`providerKey`, optional `providerName`, `fetchedAt` as ms timestamp, `keyInfo.key`, `keyInfo.info.*` with LiteLLM `/key/info` fields such as `key_alias`, `spend`, `max_budget`, `budget_duration`, `budget_reset_at`, `expires`)
- `ProviderBudget`: normalized display structure (`providerKey`, `providerName`, `keyAlias`, `spend`, `limit`, `remaining`, `percentUsed`, `duration`, `resetAt`, `expiresAt`, `lastFetched`)
- `BudgetData`: `Record<providerKey, ProviderBudget>`

### `loader.ts`

- `loadAll()` returns `{ budgets, hasErrors, errorCount }`. It reads every `*.json` in the budget directory; files that fail validation are counted as errors and skipped. A missing directory yields empty budgets without errors.
- `loadOne(providerKey)` requires `keyInfo.info.spend` and `keyInfo.info.max_budget` to be numbers, otherwise returns `null`. Missing optional fields fall back to `'Unknown'` (`key_alias`, `budget_duration`, `budget_reset_at`) or `'Never'` (`expires`).
- Provider name is `providerName` from the file, else the key split on `-` with each part capitalized (`litellm-prod` becomes `Litellm Prod`).

### `watcher.ts`

`BudgetWatcher(stateDir, onChange, logger, pollInterval = 5000)`:

- `start()` calls `fs.watch(<stateDir>/key-info, { recursive: false })` and invokes `onChange` for events on `*.json` files. There is no debouncing.
- If `fs.watch` throws (for example the directory does not exist yet), it falls back to `setInterval` polling every 5 s. The fallback is not switched back to `fs.watch` later.
- `stop()` closes the watcher and clears the timer.

### `components/KeyInfoPanel.tsx`

Props: `context: Plugin.Context`, `budgetData: BudgetData`, `loadStatus: { hasErrors, errorCount }`.

Renders a "Key Info" header and, per state:

- no budgets and errors: "Budget data parsing error (N file(s))" plus "Check logs for details"
- no budgets and no errors: "No budget data available" plus "Waiting for oclitellmac-server..."
- otherwise: one `ProviderCard` per provider

### `components/ProviderCard.tsx`

Props: `budget: ProviderBudget`, `theme: Plugin.Context['theme']`.

Shows, in a rounded-border box: provider name, text progress bar, `$spend / $limit`, percent used, remaining, reset (`Resets <relative> (<duration>)`), and an absolute locale-formatted fetch time. Progress bar and percentage are colored by usage:

- below 75%: success token
- 75% to below 90%: warning token
- 90% and above: error token

### `utils/format.ts`

Exports `formatCurrency` (USD, 2 decimals), `formatPercent` (1 decimal), `formatProgressBar` (20 chars of `█`/`░`), `formatDate`, `formatRelativeTime`, `formatSmartTime`, `formatAbsoluteTimeISO`, `formatAbsoluteTimeLocale`. The card uses currency, percent, progress bar, relative time and locale time; the others are currently unused by components.

## Logging

The TUI logs through its own file logger (see `log.ts` above). The server plugin has a separate log; for its location, [read here](../server/README.md)

## Related Documentation

- When looking for installation and configuration, [read here](../README.md)
- When looking for the budget file producer, [read here](../server/README.md)
- When building or testing the plugin, [read here](../docs/DEVELOPMENT.md)
