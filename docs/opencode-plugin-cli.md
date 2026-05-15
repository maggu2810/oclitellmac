# OpenCode Plugin CLI Reference

Source-verified reference for the OpenCode plugin installation command.

## Command Syntax

```bash
opencode plugin <module> [--global|-g] [--force|-f]
opencode plug   <module> [-g] [-f]           # alias
```

**There is no `add` subcommand.** The command is `opencode plugin <module>`, not `opencode plugin add <module>`.

### Arguments

| Argument | Type | Required | Description |
|---|---|---|---|
| `<module>` | string | yes | Plugin specifier (npm package, GitHub URL, local path) |

### Flags

| Flag | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--global` | `-g` | boolean | `false` | Install into global config (`~/.config/opencode/`) instead of local `.opencode/` |
| `--force` | `-f` | boolean | `false` | Replace existing plugin entry in config (overwrite, not skip) |

---

## Supported Plugin Specifiers

The `<module>` argument accepts any format that `npm-package-arg` recognizes:

| Format | Example | Description |
|---|---|---|
| **npm package** | `my-plugin` | Install from npm registry (appends `@latest` automatically) |
| **npm + version** | `my-plugin@1.2.3` | Install specific version from npm |
| **npm + tag** | `my-plugin@beta` | Install specific dist-tag from npm |
| **GitHub shortcut** | `github:user/repo` | Clone from GitHub (HEAD) |
| **GitHub + tag** | `github:user/repo#v1.0.0` | Clone from GitHub at specific tag/commit |
| **GitHub + semver** | `github:user/repo#semver:^1.0.0` | Clone from GitHub matching semver range |
| **Full git URL** | `https://github.com/user/repo.git` | Clone from any git URL |
| **Local relative path** | `./path/to/plugin` | Use local directory (development) |
| **Local absolute path** | `/home/user/plugin` | Use local directory (development) |
| **file:// URL** | `file:///home/user/plugin` | Use local directory via file URL |

---

## What the Command Does

### Phase 1: Install Plugin Package

**Spinner:** "Installing plugin package…"

1. Parses the `<module>` spec using `npm-package-arg`
2. For **GitHub specs** (`github:user/repo#tag`):
   - Calls `@npmcli/arborist` to clone the repo
   - Installs dependencies
   - Places package under: `~/.opencode/cache/packages/<sanitized-spec>/node_modules/<package-name>/`
3. For **npm specs**:
   - Downloads from npm registry
   - Same cache location
4. For **local paths** (`./plugin`, `/path/to/plugin`):
   - Uses the path directly (no copy, no cache)

**Spinner result:** "Plugin package ready"

### Phase 2: Read Plugin Manifest

**Spinner:** "Reading plugin manifest…"

1. Reads `package.json` from the installed/resolved directory
2. Detects plugin entry points by checking:
   - `exports["./server"]` → server plugin
   - `exports["./tui"]` → TUI plugin
   - `main` field → fallback server plugin
   - `oc-themes` field → theme-only TUI plugin
3. Validates that at least one entry point exists

**Spinner result:** "Detected server" / "Detected tui" / "Detected server + tui"

### Phase 3: Update Config Files

**Spinner:** "Updating plugin config…"

1. **Determines config directory:**
   - If `--global`: `~/.config/opencode/`
   - If local + git worktree: `<worktree>/.opencode/`
   - Otherwise: `<cwd>/.opencode/`

2. **For each detected plugin type:**
   - **Server plugin** → updates `opencode.jsonc` (or `.json`, `.json5`)
   - **TUI plugin** → updates `tui.jsonc` (or `.json`, `.json5`)

3. **Updates the `plugin` array:**
   - If spec already exists and `--force` not set: skips (reports "Already configured")
   - If `--force` set: replaces existing entry
   - Otherwise: appends new entry

4. **Preserves formatting:**
   - Uses `jsonc-parser` to maintain comments, trailing commas, indentation

**Spinner result:** "Plugin config updated"

### Phase 4: Summary

```
✓  Installed github:maggu2810/oclitellmac
   Scope: local (/your/project/.opencode)
```

Or with `--global`:
```
   Scope: global (/home/user/.config/opencode)
```

---

## Examples

### Basic GitHub Install

```bash
# Install from GitHub HEAD (latest)
opencode plugin github:maggu2810/oclitellmac

# Install from GitHub at specific tag
opencode plugin github:maggu2810/oclitellmac#v1.0.0

# Install from GitHub at specific commit
opencode plugin github:maggu2810/oclitellmac#a1b2c3d
```

### Global Install

```bash
# Install globally (available in all projects)
opencode plugin github:maggu2810/oclitellmac --global
opencode plugin github:maggu2810/oclitellmac -g
```

### Force Replace

```bash
# Replace existing plugin entry (e.g., upgrade to new version)
opencode plugin github:maggu2810/oclitellmac#v2.0.0 --force
opencode plugin github:maggu2810/oclitellmac#v2.0.0 -f
```

### Local Development

```bash
# Install from current directory
cd /path/to/my-plugin
opencode plugin .

# Install from relative path
opencode plugin ./plugins/my-plugin

# Install from absolute path
opencode plugin /home/user/dev/my-plugin
```

### npm Registry

```bash
# Install from npm (latest)
opencode plugin my-opencode-plugin

# Install specific version
opencode plugin my-opencode-plugin@1.2.3

# Install specific tag
opencode plugin my-opencode-plugin@beta
```

### Using the Alias

```bash
# All commands work with "plug" alias
opencode plug github:maggu2810/oclitellmac -g -f
```

---

## Config File Results

After running `opencode plugin github:maggu2810/oclitellmac`, your config files will contain:

### `.opencode/opencode.jsonc` (or global equivalent)

```jsonc
{
  "plugin": [
    "github:maggu2810/oclitellmac"  // if server plugin detected
  ]
}
```

### `.opencode/tui.jsonc` (or global equivalent)

```jsonc
{
  "plugin": [
    "github:maggu2810/oclitellmac"  // if TUI plugin detected
  ]
}
```

**Note:** For plugins with both server and TUI entry points (like oclitellmac), the spec is added to **both** config files.

---

## Source References

This document was verified by inspecting the OpenCode source code at:

- **CLI command definition**: `packages/opencode/src/cli/cmd/plug.ts` (lines 178–199)
- **Plugin installation flow**: `packages/opencode/src/plugin/install.ts` (lines 259–421)
- **Entry point resolution**: `packages/opencode/src/plugin/shared.ts` (lines 54, 103–213)
- **npm package installation**: `packages/core/src/npm.ts` (line 113)
- **Config file patching**: `packages/opencode/src/plugin/install.ts` (lines 333–421)

Verified against OpenCode repository at: `/home/de23a4/workspace/kion/de23a4/genai/repos/opencode/` (branch: `dev`)
