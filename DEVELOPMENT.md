# Development Guide

## Building the Plugin

The plugin requires a build step to compile TypeScript source to JavaScript in `dist/`.

### Compile Command

```bash
cd plugins/oclitellmac
bun run compile
```

This command:
1. Runs `bun install` to ensure all dependencies (including `@opentui/solid/bun-plugin`) are present
2. Compiles `server/src/` → `dist/server.js` (bundled)
3. Compiles `tui/src/` → `dist/tui.js` (bundled with Solid JSX transform)

**Note:** Dependencies listed in `package.json` (`dependencies` and `devDependencies`) are marked as `external` and NOT bundled — they are resolved at runtime from OpenCode's own `node_modules`.

### When to Build

Run `bun run compile`:
- After cloning the repository
- After modifying any source files in `server/src/` or `tui/src/`
- Before testing with `opencode plugin .`

### Build Output

The build produces:
- `dist/server.js` — bundled server plugin
- `dist/tui.js` — bundled TUI plugin with pre-transformed JSX

These files are gitignored on the `main` branch but committed on `dist-*` release branches.

### Script Naming Constraint

⚠️ **IMPORTANT:** The script must NOT be named any of the following:

- `build`
- `prepare`
- `prepack`
- `install`
- `preinstall`
- `postinstall`

**Reason:** When installing a plugin via `opencode plugin github:...`, npm's `pacote` package fetcher checks for these script names during the git fetch phase. If any are present, pacote attempts to run `npm install` inside the cloned repository to prepare dependencies for the script, which causes timeouts and "git dep preparation failed" errors.

Using a custom name like `compile` avoids this trigger, allowing pacote to skip the preparation step and directly pack the plugin for installation.

### Dependency Classification

#### Why `peerDependencies` Must Not Be Used

**Do not declare `@opentui/*` or `solid-js` in `peerDependencies`.** When OpenCode installs the plugin via `opencode plugin github:...`, arborist installs both `dependencies` **and** `peerDependencies` into the plugin's own `node_modules`. This causes packages like `@opentui/core` to be loaded twice in the same process:

1. Once from OpenCode's own `node_modules` (the correct copy)
2. Once from the plugin's `node_modules` (duplicate)

This triggers fatal errors at startup:

```
Error: Environment variable "OTUI_TREE_SITTER_WORKER_PATH" is already registered
with different configuration
```

The duplicate registration happens because both copies of `@opentui/core` try to initialize the same global state.

#### Why `devDependencies` Is Correct

Arborist **skips** `devDependencies` during plugin installation, so they never appear in the plugin's `node_modules`. At runtime:

- `dist/tui.js` imports `@opentui/solid`, `solid-js`, etc. by name
- Bun's module resolution walks up the directory tree
- It finds OpenCode's own `node_modules` and uses the single correct copy

Locally during development:

- `bun install` installs `devDependencies` normally
- The IDE gets full type information and autocomplete
- `scripts/build.ts` can import `@opentui/solid/bun-plugin` for JSX compilation

#### Which `devDependencies` Serve Which Purpose

| Package | Purpose |
|---|---|
| `@opentui/core` | IDE types only (imported in TUI source; resolved from OpenCode at runtime) |
| `@opentui/keymap` | IDE types only (same as above) |
| `@opentui/solid` | IDE types + build script (`createSolidTransformPlugin` in `scripts/build.ts`) |
| `solid-js` | IDE types only (imported in TUI source; resolved from OpenCode at runtime) |
| `typescript` | Type checking only (`npx tsc --noEmit`) |

**Key principle:** Packages used at runtime by the plugin must be marked `external` in the build (which we do automatically in `scripts/build.ts`) and must NOT appear in `dependencies` or `peerDependencies`. They are resolved from OpenCode's environment at runtime.

---

## Import Style Convention

### Rule

**Use extensionless imports for all relative module imports.**

✅ **Correct:**
```typescript
import { getConfigPath } from "./paths"
import { categorizeModel } from "./categorize"
import type { Category } from "./categorize"
```

❌ **Incorrect:**
```typescript
import { getConfigPath } from "./paths.js"   // Don't use .js
import { getConfigPath } from "./paths.ts"   // Don't use .ts
```

### Rationale

1. **GitHub Install Compatibility**: When installed via `opencode plugin github:maggu2810/oclitellmac`, imports with `.js` extensions fail because Bun's module resolution in `node_modules` context doesn't automatically resolve `.js` → `.ts`.

2. **Consistency**: Works identically in all installation contexts:
   - ✅ Local path: `opencode plugin .`
   - ✅ GitHub URL: `opencode plugin github:maggu2810/oclitellmac`
   - ✅ npm package: `opencode plugin @maggu2810/oclitellmac`

3. **TypeScript Compatibility**: Supported by `moduleResolution: "bundler"` in `tsconfig.json`, which is the correct setting for Bun runtime.

4. **No Build Step**: Extensionless imports work with raw TypeScript source (no compilation needed).

### Technical Details

- **Module Resolution**: `tsconfig.json` uses `"moduleResolution": "bundler"`
- **Runtime**: Bun handles TypeScript directly at runtime
- **TypeScript Compilation**: `"noEmit": true"` — no JavaScript output
- **Path Management**: See [PATH-STRATEGY.md](PATH-STRATEGY.md) for XDG conventions

---

## Type Checking

Run TypeScript type checker:

```bash
cd plugins/oclitellmac
npx tsc --noEmit
```

**Expected:** Warnings about peer dependencies (`@opentui/*`, `solid-js`) are normal and can be ignored.

---

## Architecture

- **Server Plugin**: See [server/ARCHITECTURE.md](server/ARCHITECTURE.md) for modular pipeline design
- **TUI Plugin**: See [tui/README.md](tui/README.md) for component structure
- **Producer-Consumer Pattern**: See [README.md](README.md#architecture) for overview

---

## Testing Changes

### Local Install

```bash
cd plugins/oclitellmac
bun run compile            # Build first
opencode plugin .          # Install locally
```

### GitHub Install

Install from a dist branch (see [Release Workflow](#release-workflow) below):

```bash
opencode plugin github:maggu2810/oclitellmac#dist-v0.1.0
```

**Verification:**
1. Check OpenCode logs: `INFO service=plugin ... loading plugin`
2. Verify no ENOENT errors
3. Confirm models appear in OpenCode
4. Check TUI sidebar shows budget data

---

## Release Workflow

To publish a new release for GitHub installation:

### 1. Build the Plugin

```bash
cd plugins/oclitellmac
bun run compile
```

Verify `dist/server.js` and `dist/tui.js` exist and are up-to-date.

### 2. Create Orphan Branch

```bash
git checkout --orphan tmp-dist-v0.1.0
git rm -rf --cached .
git add -f package.json dist/
git commit -m "dist v0.1.0"
```

**What this does:**
- Creates a new branch with no commit history (`--orphan`)
- Unstages all files from the index
- Stages only `package.json` and `dist/` directory
- Commits these files at the branch root

### 3. Tag and Push

```bash
git tag dist-v0.1.0
git push origin refs/tags/dist-v0.1.0
```

### 4. Return to Main Branch

```bash
git clean -x -d -f
git checkout main
git branch -D tmp-dist-v0.1.0  # Optional: delete local orphan branch
```

### 5. Install via GitHub

Users can now install:

```bash
opencode plugin github:maggu2810/oclitellmac#dist-v0.1.0
```

### Notes

- The `dist-*` branch contains only `package.json` and `dist/` at its root (no `src/`, no history)
- `package.json` exports already point to `./dist/server.js` and `./dist/tui.js` (same on main and dist branches)
- This approach is standard for GitHub-based distribution (similar to npm publish, but using git branches instead of the npm registry)

---

## Common Issues

### Import Resolution Errors

**Symptom:** `ENOENT: no such file or directory, open '.../something.js'`

**Cause:** Import has `.js` extension but file is `.ts`

**Fix:** Remove the extension from the import statement

### Type Check Failures

**Symptom:** `Cannot find module './foo' or its corresponding type declarations`

**Cause:** TypeScript can't resolve extensionless import

**Fix:** Verify `tsconfig.json` has `"moduleResolution": "bundler"`

---

## Additional Documentation

For more detailed information, see:

- **Configuration**: [CONFIGURATION.md](CONFIGURATION.md) - Server configuration reference
- **Installation**: [INSTALL.md](INSTALL.md) - Setup and verification guide
- **Path Strategy**: [PATH-STRATEGY.md](PATH-STRATEGY.md) - XDG path management rationale
- **Server Implementation**: [server/IMPLEMENTATION.md](server/IMPLEMENTATION.md) - Implementation details
- **Server Verification**: [server/VERIFICATION.md](server/VERIFICATION.md) - Testing guide
