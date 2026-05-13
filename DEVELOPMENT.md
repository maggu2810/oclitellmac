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

### Files Field Requirement

The `package.json` includes a `"files": ["dist/"]` field. This is **critical** for GitHub installs:

**Why it's needed:**
- When installing via `opencode plugin github:...`, pacote packs the repo into a tarball
- Without the `files` field, pacote reads `.gitignore` and excludes `dist/` from the pack
- Result: `dist/` exists on the branch but is missing from the installed package → "Cannot find module" errors

**The `files` field explicitly lists what to include**, overriding `.gitignore`. Only `dist/` and `package.json` (always included) are packed into the tarball.

**IMPORTANT:** Do not remove the `files` field or add additional patterns unless intentional.

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

---

## Dependency Management

This section explains how dependencies work in this plugin and provides rules for adding new dependencies correctly.

### npm Dependency Types — Overview

| Type | Installed when? | Purpose |
|---|---|---|
| `dependencies` | Always — both `bun install` (dev) and arborist (plugin install) | Packages needed at **runtime** by the plugin |
| `devDependencies` | Only `bun install` (dev) — **skipped** by arborist during plugin install | Tools, types, and packages only needed during development/build |
| `peerDependencies` | Modern npm/bun: installed automatically (v7+) | Packages the consumer is expected to provide — **DO NOT USE** in this plugin |

**Key takeaway for our plugin:**

- Arborist (OpenCode's plugin installer) installs `dependencies` + `peerDependencies`, skips `devDependencies`
- We only want arborist to install `dependencies`
- Therefore: everything that must NOT end up in the plugin's `node_modules` → `devDependencies`

### Bun Build `external` — What It Means

When compiling with `Bun.build()`, the `external` option controls what gets **bundled into the output file vs. left as a runtime import**:

| Status | In `dist/tui.js` | Resolved at runtime from... |
|---|---|---|
| **Bundled** (not external) | Code is inlined into the file | Nowhere — it's already compiled into the file |
| **External** | `import { foo } from "pkg"` remains | Must exist in `node_modules` at runtime |

**Key takeaway:** If you mark something as `external`, it must exist on disk at runtime where the plugin loads. For OpenCode GitHub installs, the only `node_modules` available are packages arborist installed (i.e., only `dependencies`).

### The OpenCode Binary Problem

**OpenCode is a compiled binary** — packages like `@opentui/solid`, `@opentui/core`, and `solid-js` are compiled into it. They do **not** exist as files on disk in `node_modules` anywhere. This means:

- Runtime `import` resolution cannot find them
- Marking them as `external` in the build fails (module not found)
- Marking them as `peerDependencies` or `dependencies` causes duplicates (loaded twice → crashes)

**The solution:** Bundle safe packages (no global state) into `dist/tui.js`, keep unsafe packages (register globals) as `external` and rely on OpenCode's internal resolution.

### Package Groups

#### Group 1: OpenCode Host Packages

Packages compiled into the OpenCode binary. Special handling required based on import context.

| Package | Handling | Rationale |
|---|---|---|
| `@opentui/solid` | `dependencies` (pinned version) + `external` | Contains shared `RendererContext` — bundling creates isolated copy |
| `solid-js` | `devDependencies`, **not** external → bundled | Pure reactive primitives, safe to bundle |
| `@opentui/core` | `dependencies` (pinned version) + `external` | Bun resolves embedded packages only for .tsx; pre-bundled .js needs node_modules |
| `@opentui/keymap` | `dependencies` (pinned version) + `external` | Same reason as @opentui/core |

**Why `@opentui/solid` must NOT be bundled:**

- `@opentui/solid` creates a `RendererContext` (Solid.js context for the terminal renderer)
- The OpenCode binary provides the renderer through its own `RendererContext` instance
- If bundled into `dist/tui.js`, the plugin creates a **second isolated copy** of `RendererContext`
- When JSX calls `createElement("box")`, it does `useContext(RendererContext)` on the bundled copy
- That context has no provider → returns `undefined` → `"No renderer found"` error or silent failure
- **Solution:** Keep `@opentui/solid` external so the plugin uses the binary's shared instance

**Why `@opentui/core` and `@opentui/keymap` must be in `dependencies`:**

- Bun's embedded packages (compiled into the binary) are available for **on-the-fly `.tsx` transpilation** only
- Pre-bundled `.js` files (like `dist/tui.js`) use standard Node.js resolution (filesystem `node_modules` walk)
- `dist/tui.js` has `import { ... } from "@opentui/core"` (external) → needs real `node_modules/@opentui/core`
- Adding to `dependencies` → arborist installs during GitHub plugin install → external imports resolve
- Bundling them would include 4.7MB of tree-sitter WASM files → bloat and potential conflicts

**Critical: Version Pinning Requirement**

`@opentui/core`, `@opentui/keymap`, and `@opentui/solid` **MUST** be pinned to the **exact version** compiled into the OpenCode binary:

- Mismatched versions cause fatal crashes: `registerEnvVar()` throws if env var descriptions differ between versions
- Even minor version bumps (0.2.6 → 0.2.8) change descriptions: `"Path to the TreeSitter worker"` → `"Path to the TreeSitter worker entry script"`
- The plugin loads `@opentui/core` from its own `node_modules`, which calls `registerEnvVar()` with the new description
- The binary already registered the same env var with the old description → conflict → crash
- `@opentui/solid` must match to ensure `RendererContext` compatibility (same internal structure)

**How to find the correct version:**

1. Check the OpenCode source repository you're targeting
2. Look in `repos/opencode/package.json` under `"catalog"` section
3. Find `"@opentui/core": "X.Y.Z"`, `"@opentui/keymap": "X.Y.Z"`, and `"@opentui/solid": "X.Y.Z"`
4. Pin to exactly those versions in this plugin's `dependencies`

**Current pinned versions:** `0.2.6` (matches OpenCode binary compiled from `repos/opencode` dev branch as of 2026-05-13)

**Maintenance note:** When OpenCode updates `@opentui/*` packages, this plugin must be updated to match. This is a known limitation of the pre-bundled `.js` approach.

#### Group 2: Independently Installed Packages

Packages **not** in the OpenCode binary. These must be installed at runtime.

| Package | Handling |
|---|---|
| `@opencode-ai/plugin` | `dependencies` + `external` |
| `@opencode-ai/sdk` | `dependencies` + `external` |
| `xdg-basedir` | `dependencies` + `external` |
| `zod` | `dependencies` + `external` |

These go in `dependencies`, are marked `external` in the build, and arborist installs them into the plugin's `node_modules` during GitHub install.

### Current Configuration Summary

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "latest",
    "@opencode-ai/sdk": "latest",
    "@opentui/core": "0.2.6",     // Pinned - MUST match OpenCode binary version
    "@opentui/keymap": "0.2.6",   // Pinned - MUST match OpenCode binary version
    "@opentui/solid": "0.2.6",    // Pinned - MUST match OpenCode binary version
    "xdg-basedir": "^5.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "solid-js": "*",              // Bundled (safe)
    "typescript": "^5.6.0"        // Dev-only (type checking)
  }
}
```

**Build script (`scripts/build.ts`) logic:**

```ts
const external = [
  ...Object.keys(pkg.dependencies ?? {}),  // Always external (installed by arborist)
]
// devDependencies (solid-js) are bundled into dist/ files
```

### Rules for Adding New Dependencies

When adding a new dependency, ask these questions:

#### 1. Is it needed at runtime (in the compiled `dist/` output)?

- **No** → `devDependencies`, not external (won't appear in dist output)
  - Example: `eslint`, `prettier`, build tools
- **Yes** → Continue to question 2

#### 2. Is it compiled into the OpenCode binary?

- **No** → `dependencies` + `external` (arborist installs it, dist imports it from `node_modules`)
  - Example: `zod`, `xdg-basedir`, npm packages OpenCode doesn't bundle
- **Yes** → Continue to question 3

#### 3. Can it be safely bundled into dist/ files?

- **Yes (pure library, no WASM/assets, no shared context)** → `devDependencies`, **not** external (bundle it)
  - Example: `solid-js` (pure reactive primitives)
- **No (includes WASM, large assets, shared global state, or needs .tsx context)** → `dependencies` + `external`
  - Add it to `dependencies` so arborist installs it
  - Example: `@opentui/core` (4.7MB tree-sitter WASM), `@opentui/solid` (shared `RendererContext`), `@opentui/keymap`

#### Decision Table

| Scenario | `package.json` | Build `external`? | Result |
|---|---|---|---|
| npm package, runtime needed | `dependencies` | ✅ Yes (auto via `Object.keys(dependencies)`) | Arborist installs, dist imports from `node_modules` |
| OpenCode binary package, safe to bundle (small, pure, no shared state) | `devDependencies` | ❌ No | Bundled into `dist/` files |
| OpenCode binary package, unsafe to bundle (WASM/assets/shared context) | `dependencies` | ✅ Yes (auto via `Object.keys(dependencies)`) | Arborist installs, dist imports from `node_modules` |
| Dev tool only | `devDependencies` | ❌ No | Not included in dist at all |

### Examples

**Adding a new npm package for runtime use:**

```json
"dependencies": {
  "my-new-package": "^1.0.0"  // Automatically marked external by build script
}
```

**Adding an OpenCode package that's safe to bundle:**

1. Check if it includes WASM files, large assets, or shared global state (contexts, singletons)
2. If small, pure, and no shared state (no WASM, no contexts): add to `devDependencies`, do **not** add to `external`
3. If includes WASM/assets/shared state: add to `dependencies` (auto-external via `Object.keys(dependencies)`)

**Adding an OpenCode package with WASM, large assets, or shared context:**

1. Add to `dependencies` (not `devDependencies`), pinned to OpenCode binary's version
2. Arborist will install it, external imports will resolve from `node_modules`
3. No changes needed to `scripts/build.ts` — auto-external via `Object.keys(dependencies)`

### Why `peerDependencies` Must Never Be Used

Modern npm (v7+) and bun **automatically install** `peerDependencies`. When OpenCode installs the plugin via `opencode plugin github:...`, arborist installs both `dependencies` **and** `peerDependencies` into the plugin's own `node_modules`.

This causes packages like `@opentui/core` to be loaded twice:
1. Once from OpenCode's binary (the correct copy)
2. Once from the plugin's `node_modules` (duplicate)

Result: duplicate global state registration → fatal crash.

**Solution:** Never use `peerDependencies`. Use `devDependencies` instead — arborist skips them during plugin install.

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
