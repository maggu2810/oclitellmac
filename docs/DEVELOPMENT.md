# Development Guide

## Project Structure

```
plugins/oclitellmac/
├── package.json          # exports ./server and ./tui -> dist/
├── tsconfig.json         # type checking only (noEmit)
├── scripts/build.ts      # Bun build for both bundles
├── server/
│   ├── src/              # server plugin source
│   ├── test/             # bun tests
│   └── *.md              # ARCHITECTURE, IMPLEMENTATION, VERIFICATION, README
├── tui/
│   ├── src/              # TUI plugin source (Solid JSX)
│   └── README.md
├── docs/                 # CONFIGURATION, INSTALL, PUBLISH, PATH-STRATEGY, ...
└── dist/                 # build output (gitignored)
```

When looking for the module layout of a plugin, [read here for the server](../server/README.md) or [read here for the TUI](../tui/README.md)

## Building the Plugin

The plugin must be built before OpenCode can load it:

```bash
cd plugins/oclitellmac
bun run build
```

`scripts/build.ts` does the following:

1. Runs `bun install` so `@opentui/solid/bun-plugin` is available
2. Bundles `server/src/index.ts` to `dist/server.js` (ESM, `target: "node"`)
3. Bundles `tui/src/index.tsx` to `dist/tui.js` (ESM, `target: "node"`, Solid transform plugin so JSX is pre-compiled)

Every package in `dependencies`, `devDependencies` and `peerDependencies` is marked `external` and not bundled.

`dist/` is gitignored. `package.json` has `"files": ["dist/"]` so that npm/bun publish includes it despite `.gitignore`; do not remove that field.

When publishing to npm, [read here](PUBLISH.md)

## Dependency Management

When adding a dependency, decide by where it is resolved at runtime:

| Package group | Declared in | Notes |
| --- | --- | --- |
| `@opentui/core`, `@opentui/keymap`, `@opentui/solid`, `solid-js` | `devDependencies` + optional `peerDependencies` | Provided by the OpenCode binary at runtime; must stay external and must not be installed or bundled a second time |
| `@opencode/plugin` | `devDependencies` | Type-only imports (`@opencode/plugin`, `@opencode/plugin/tui`); not needed at runtime |
| `xdg-basedir`, `zod` | `dependencies` | Imported at runtime from the plugin's own `node_modules` |

Rules:

- The `@opentui/*` devDependencies are pinned to the exact version used by the targeted OpenCode release so type checking matches the binary; the peer range is `>=` that version. For the current values, read `package.json`.
- A second copy of `@opentui/solid` would have its own renderer context and break rendering, so keep these packages external.
- The V1 packages `@opencode-ai/plugin` and `@opencode-ai/sdk` are no longer used.
- Provider packages the plugin hands to OpenCode (`@opencode/ai/providers/openai-compatible`, `@opencode/ai/providers/anthropic`) are referenced by name only; they must be bundled in the OpenCode binary.
- Because the build externalizes all three dependency fields, a new package needs no build change.

When checking which opencode version the plugin was verified against, [read here](../../../docs/litellm-integration/source-map.md)

## Import Style Convention

Use extensionless relative imports (no `.js`/`.ts`):

```typescript
import { getBudgetDataDir } from "./paths"
import type { ProviderBudget } from "./types"
```

`tsconfig.json` uses `"moduleResolution": "bundler"` and `"noEmit": true`. For XDG path handling, [read here](PATH-STRATEGY.md)

## TypeScript and JSX

- `tsconfig.json` sets `"jsx": "preserve"` and `"jsxImportSource": "@opentui/solid"`; it includes `server/src` and `tui/src`.
- TUI files containing JSX must use the `.tsx` extension and start with `/** @jsxImportSource @opentui/solid */`.
- The actual JSX compilation happens in the build via the Solid transform plugin, not via `tsc`.

## Testing

Unit tests live in `server/test/`:

```bash
cd plugins/oclitellmac
bun test
```

When running the manual end-to-end checklist (including cache diagnostics), [read here](../server/VERIFICATION.md)

## Local Development Loop

1. Edit `server/src/` or `tui/src/`
2. `bun run build`
3. Restart OpenCode (plugins are loaded at startup)
4. Check the logs: `~/.local/state/oclitellmac/server.log` (server) and `~/.local/state/oclitellmac/log/tui/` (TUI)

For local registration, point OpenCode at the absolute path of the `dist` directory (`<repo>/plugins/oclitellmac/dist`), not the project root. When registering the plugin or looking up CLI usage and spec formats, [read here](opencode-plugin-cli.md)

## Architecture

- When working on the server pipeline, [read here](../server/ARCHITECTURE.md)
- When working on the TUI components, [read here](../tui/README.md)

## Release Workflow (GitHub dist tag)

To publish a built `dist/` for git-based installation:

```bash
cd plugins/oclitellmac
bun run build
git checkout --orphan tmp-dist-v0.1.0
git rm -rf --cached .
git add -f package.json dist/
git commit -m "dist v0.1.0"
git tag dist-v0.1.0
git push origin refs/tags/dist-v0.1.0
git clean -x -d -f
git checkout main
git branch -D tmp-dist-v0.1.0
```

The tagged commit contains only `package.json` and `dist/` at its root; `package.json` `exports` point at `./dist/server.js` and `./dist/tui.js`. When installing from a git spec, [read here](opencode-plugin-cli.md)

## Common Issues

### Import Resolution Errors

**Symptom:** `ENOENT: no such file or directory, open '.../something.js'`
**Cause:** an import has a `.js` extension but the file is `.ts`
**Fix:** remove the extension

### Type Check Failures

**Symptom:** `Cannot find module './foo' or its corresponding type declarations`
**Fix:** verify `tsconfig.json` has `"moduleResolution": "bundler"`

## Additional Documentation

- When configuring the server plugin, [read here](CONFIGURATION.md)
- When installing or verifying a setup, [read here](INSTALL.md)
- When working on the server implementation, [read here](../server/IMPLEMENTATION.md)
- When testing the server, [read here](../server/VERIFICATION.md)
