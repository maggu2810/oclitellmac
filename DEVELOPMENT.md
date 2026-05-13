# Development Guide

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
opencode plugin .
```

### GitHub Install

```bash
opencode plugin github:maggu2810/oclitellmac
```

**Verification:**
1. Check OpenCode logs: `INFO service=plugin ... loading plugin`
2. Verify no ENOENT errors
3. Confirm models appear in OpenCode
4. Check TUI sidebar shows budget data

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
