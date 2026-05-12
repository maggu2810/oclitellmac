# Path Management Strategy

This document explains the path management approach used by the `oclitellmac` plugin and the rationale behind choosing `xdg-basedir` over alternative solutions.

## Overview

The `oclitellmac` plugin needs to store configuration and state data in user directories that:
1. Are accessible across plugin sessions
2. Follow platform conventions (where reasonable)
3. Can be overridden by environment variables (on Linux)
4. Are consistent with OpenCode core's approach

## Three Approaches Considered

### Option 1: Hardcoded Paths

**Implementation:**
```typescript
import { homedir } from 'os'
import path from 'path'

const configPath = path.join(homedir(), '.config', 'oclitellmac', 'server.json')
const stateDir = path.join(homedir(), '.local', 'state', 'oclitellmac')
```

**Pros:**
- ✅ Simple, no dependencies
- ✅ Explicit and predictable
- ✅ Uses Unix-style paths on all platforms

**Cons:**
- ❌ Not XDG-compliant (ignores `XDG_CONFIG_HOME`, `XDG_STATE_HOME` environment variables)
- ❌ No flexibility for Linux users who customize XDG paths
- ❌ Creates Unix-style paths on Windows (`.config`, `.local/state`) - non-standard but acceptable

### Option 2: `env-paths` Library

**Implementation:**
```typescript
import envPaths from 'env-paths'

const paths = envPaths('oclitellmac', { suffix: '' })
// paths.config -> platform-specific config directory
// paths.data -> platform-specific data directory
```

**Platform Behavior:**
- **Linux**: `~/.config/oclitellmac`, `~/.local/share/oclitellmac`
- **macOS**: `~/Library/Preferences/oclitellmac`, `~/Library/Application Support/oclitellmac`
- **Windows**: `%APPDATA%\oclitellmac`, `%LOCALAPPDATA%\oclitellmac`

**Pros:**
- ✅ Platform-native paths (follows each OS's conventions)
- ✅ Popular library with wide adoption
- ✅ Respects XDG environment variables on Linux

**Cons:**
- ❌ **Different paths than OpenCode core** (OpenCode uses Unix-style paths everywhere)
- ❌ **No `state` directory concept** (only has `data`, `config`, `cache`, `log`, `temp`)
- ❌ Would require using `paths.data` or `paths.log` for budget/provider data (wrong semantics)
- ❌ Inconsistent user experience across platforms
- ❌ More complex documentation (different paths per platform)

### Option 3: `xdg-basedir` Library (Chosen)

**Implementation:**
```typescript
import { xdgConfig, xdgState } from 'xdg-basedir'
import path from 'path'

export const configHome = xdgConfig 
  ? path.join(xdgConfig, 'oclitellmac')
  : undefined

export const stateHome = xdgState
  ? path.join(xdgState, 'oclitellmac')
  : undefined
```

**Platform Behavior:**
- **Linux**: `~/.config/oclitellmac`, `~/.local/state/oclitellmac` (respects `XDG_*` vars)
- **macOS**: `~/.config/oclitellmac`, `~/.local/state/oclitellmac` (Unix-style paths)
- **Windows**: `C:\Users\username\.config\oclitellmac`, `C:\Users\username\.local\state\oclitellmac` (Unix-style paths)

**Pros:**
- ✅ **Fully XDG-compliant on Linux** (respects `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME`)
- ✅ **Consistent with OpenCode core** (same library, same approach, same paths)
- ✅ **Has `xdgState` directory concept** (semantically correct for budget/provider cache data)
- ✅ **Same paths on all platforms** (simple documentation, predictable UX)
- ✅ **Proven working** (OpenCode uses it successfully on Windows/macOS with active CI and users)
- ✅ Allows Linux users to customize paths via environment variables

**Cons:**
- ⚠️ **Ignores library author's "meant for Linux" warning** (but so does OpenCode)
- ⚠️ **Uses Unix-style paths on Windows** (`.config` vs `AppData`) - non-standard but acceptable
- ⚠️ Creates hidden directories on non-Linux platforms (`.config`, `.local`)

## Decision Rationale

We chose **Option 3 (`xdg-basedir`)** because:

1. **Consistency with OpenCode Core**: The most important factor. OpenCode core uses `xdg-basedir` and creates Unix-style paths on all platforms. Our plugin should follow the same approach for consistency.

2. **XDG Compliance**: Respects XDG environment variables on Linux, allowing power users to customize directory locations.

3. **Semantic Correctness**: The `xdgState` directory is semantically appropriate for budget/provider data (persistent but regenerable), unlike `env-paths` which lacks this concept.

4. **Proven Working**: OpenCode core's successful use of `xdg-basedir` on Windows/macOS demonstrates this approach works in practice, despite the library author's warning.

5. **Simpler Documentation**: Same paths on all platforms means simpler user documentation and predictable behavior.

## XDG Base Directory Specification

The [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) defines environment variables for organizing user-specific application data on Linux:

- **`XDG_CONFIG_HOME`**: User-specific configuration files (default: `~/.config`)
- **`XDG_STATE_HOME`**: User-specific state data (default: `~/.local/state`)
- **`XDG_CACHE_HOME`**: User-specific cache data (default: `~/.cache`)

### State vs Cache vs Data

- **Config** (`XDG_CONFIG_HOME`): Configuration files that control application behavior
  - **Our usage**: `server.json` (endpoint configuration)

- **State** (`XDG_STATE_HOME`): Persistent data that survives between sessions but can be regenerated
  - **Our usage**: Provider cache (model lists), budget data (usage tracking)
  - **Characteristics**: Not critical, can be deleted, regenerated on next run

- **Cache** (`XDG_CACHE_HOME`): Non-essential data that speeds up operations
  - **Our usage**: Currently unused, but available for future use

## Implementation Details

### Path Abstraction Layer

Both server and TUI plugins use a `paths.ts` module that wraps `xdg-basedir` and exports specific subdirectory functions:

**Server Plugin** (`server/src/paths.ts`):
```typescript
import { xdgConfig, xdgState, xdgCache } from "xdg-basedir"
import path from "path"

// Base directories (exported for transparency)
export const configHome = xdgConfig 
  ? path.join(xdgConfig, "oclitellmac")
  : undefined

export const stateHome = xdgState
  ? path.join(xdgState, "oclitellmac")
  : undefined

// Base directory getters (with validation)
export function getConfigDir(): string {
  if (!configHome) {
    throw new Error("XDG_CONFIG_HOME is not set and home directory could not be determined")
  }
  return configHome
}

export function getStateDir(): string {
  if (!stateHome) {
    throw new Error("XDG_STATE_HOME is not set and home directory could not be determined")
  }
  return stateHome
}

// Specific paths (most commonly used by consumers)
export function getConfigPath(): string {
  return path.join(getConfigDir(), "server.json")
}

export function getProviderCacheDir(): string {
  return path.join(getStateDir(), "providers")
}

export function getBudgetDataDir(): string {
  return path.join(getStateDir(), "key-info")
}
```

**TUI Plugin** (`tui/src/paths.ts`):
```typescript
import { xdgState } from "xdg-basedir"
import path from "path"

export const stateHome = xdgState
  ? path.join(xdgState, "oclitellmac")
  : undefined

export function getStateDir(): string {
  if (!stateHome) {
    throw new Error("XDG_STATE_HOME is not set and home directory could not be determined")
  }
  return stateHome
}

export function getBudgetDataDir(): string {
  return path.join(getStateDir(), "key-info")
}
```

### Benefits of Specific Subdirectory Functions

This approach (inspired by OpenCode core's `global.ts`) provides:

1. **Centralized Structure**: All subdirectory names defined in one place
2. **Easy Refactoring**: Change subdirectory name in one place, all consumers updated
3. **Clear Intent**: Function names document purpose (`getBudgetDataDir()` vs `path.join(stateHome, 'key-info')`)
4. **Consistent Usage**: All consumers use same paths
5. **Better Abstraction**: Hides internal directory structure from consumers
6. **Self-Documenting**: Function names indicate what data lives where

### Why Independent Codebases?

The server and TUI plugins have **separate `paths.ts` files** (no shared code) because:

1. **Logical Separation**: Server and TUI are independent entry points with no shared runtime
2. **Minimal Coupling**: Each plugin only imports what it needs
3. **Clear Ownership**: Each plugin manages its own path logic
4. **Easier Maintenance**: Changes to one plugin don't affect the other

## Platform-Specific Examples

### Linux (Default)

```bash
# Config file
~/.config/oclitellmac/server.json

# State data
~/.local/state/oclitellmac/providers/litellm-prod.json
~/.local/state/oclitellmac/key-info/litellm-prod.json
```

### Linux (Custom XDG Paths)

```bash
# Override XDG directories
export XDG_CONFIG_HOME="$HOME/my-config"
export XDG_STATE_HOME="$HOME/my-state"

# Resulting paths
~/my-config/oclitellmac/server.json
~/my-state/oclitellmac/providers/litellm-prod.json
~/my-state/oclitellmac/key-info/litellm-prod.json
```

### macOS (Unix-Style Paths)

```bash
# Config file
~/.config/oclitellmac/server.json

# State data
~/.local/state/oclitellmac/providers/litellm-prod.json
~/.local/state/oclitellmac/key-info/litellm-prod.json
```

### Windows (Unix-Style Paths)

```cmd
REM Config file
C:\Users\username\.config\oclitellmac\server.json

REM State data
C:\Users\username\.local\state\oclitellmac\providers\litellm-prod.json
C:\Users\username\.local\state\oclitellmac\key-info\litellm-prod.json
```

## Migration Notes

### Breaking Change

This implementation creates new paths that differ from the original hardcoded approach:

**Before**: `~/.local/state/oclitellmac/` (hardcoded)
**After**: `~/.local/state/oclitellmac/` (via `xdg-basedir`)

On **Linux with custom XDG variables**, paths may change:

```bash
# If user has custom XDG_STATE_HOME
export XDG_STATE_HOME="$HOME/custom-state"

# Old path (hardcoded): ~/.local/state/oclitellmac/
# New path (XDG-aware): ~/custom-state/oclitellmac/
```

Users with custom XDG paths should:
1. Verify new paths work correctly
2. Manually migrate old data if needed
3. Clean up old directories after verification

### No Backward Compatibility

The plugin does **not** attempt to migrate old data automatically. This is acceptable because:
- Current user base is small (primarily the developer)
- Budget/provider data is regenerable
- Manual migration is straightforward if needed

## Future Considerations

### Potential Enhancements

1. **Migration Helper**: Add a command to migrate data from old paths to new XDG paths
2. **Cache Directory**: Use `xdgCache` for truly ephemeral data (currently unused)
3. **Path Override CLI**: Add CLI flags to override paths without environment variables

### Alternative Approaches Revisited

If future requirements change (e.g., need for platform-native paths), we could:

1. **Switch to `env-paths`**: If OpenCode core changes its approach
2. **Add Platform Detection**: Use `xdg-basedir` on Linux, native paths elsewhere
3. **Make Configurable**: Allow users to choose path strategy in config

However, maintaining consistency with OpenCode core should remain the primary goal.

## References

- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
- [xdg-basedir npm package](https://www.npmjs.com/package/xdg-basedir)
- [env-paths npm package](https://www.npmjs.com/package/env-paths)
- [OpenCode core global.ts](../../repos/opencode/packages/core/src/global.ts)

## Summary

The `xdg-basedir` approach provides:
- ✅ XDG compliance on Linux
- ✅ Consistency with OpenCode core
- ✅ Semantic correctness (state vs cache vs config)
- ✅ Simple, predictable paths across platforms
- ✅ Proven working in production (via OpenCode)

While it creates non-standard Unix-style paths on Windows/macOS, this trade-off is acceptable for consistency with OpenCode core and simplicity of documentation.
