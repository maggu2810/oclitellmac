# Installation and Testing Guide

This guide walks you through installing and verifying the oclitellmac plugin.

**For features and detailed reference**, see [README.md](../README.md).  
**For configuration details**, see [CONFIGURATION.md](CONFIGURATION.md).

## Quick Start

### npm Package Installation (Recommended)

Install from npm registry:

```bash
# Global installation (available in all projects)
opencode plugin oclitellmac --global

# Project-local installation
opencode plugin oclitellmac
```

OpenCode automatically:
- Downloads the package from npm
- Installs dependencies
- Registers both entry points (server + TUI)

Skip to step 2 (Configure Server Plugin) below.

### Local Development

For development or testing local changes:

```bash
# Clone repository
git clone https://github.com/maggu2810/oclitellmac.git
cd oclitellmac

# Install dependencies
npm install

# Register with OpenCode
opencode plugin .
```

### 1. Configure OpenCode (Local Path Only)

**Note**: `opencode plugin .` does this automatically. Manual editing is only needed as a fallback.

For **local config**, edit `.opencode/opencode.json` (or `.opencode/opencode.jsonc`) and `.opencode/tui.json` (or `.opencode/tui.jsonc`) separately:

`.opencode/opencode.json`:
```json
{
  "plugin": ["./oclitellmac"]
}
```

`.opencode/tui.json`:
```json
{
  "plugin": ["./oclitellmac"]
}
```

For **global config**, use absolute paths in `~/.config/opencode/opencode.json` (or `.jsonc`) and `~/.config/opencode/tui.json` (or `.jsonc`):

```json
{
  "plugin": ["/absolute/path/to/oclitellmac"]
}
```

### 2. Configure Server Plugin

Create `~/.config/oclitellmac/server.json` with your LiteLLM endpoint(s):

```json
{
  "endpoints": [
    {
      "baseUrl": "https://your-litellm-proxy.example.com",
      "apiKey": "sk-your-api-key",
      "providerKey": "my-litellm",
      "enabled": true
    }
  ]
}
```

**For detailed configuration options**, see [CONFIGURATION.md](CONFIGURATION.md).

**For complete examples**, see [`server/config-example.json`](../server/config-example.json).

### 3. Restart OpenCode

```bash
# If running, restart OpenCode to load the plugins
```

## Expected Behavior

### Server Plugin
- Loads on OpenCode startup
- Fetches model lists from LiteLLM endpoints
- Injects providers into OpenCode configuration
- Starts budget tracking (polls every 60s)
- Writes data to state directory (see Platform-Specific Paths below)

### TUI Plugin
- Loads when TUI starts
- Reads budget files from state directory
- Displays budget panels in sidebar
- Updates immediately when budget files change (via file watcher)
- Shows fetch timestamp in local timezone

### Platform-Specific Paths

**Configuration File** (where you create `server.json`):

| Platform | Default Path | Custom Path (via environment variable) |
|----------|--------------|----------------------------------------|
| Linux | `~/.config/oclitellmac/server.json` | `$XDG_CONFIG_HOME/oclitellmac/server.json` |
| macOS | `~/.config/oclitellmac/server.json` | N/A (XDG vars not used) |
| Windows | `C:\Users\<username>\.config\oclitellmac\server.json` | N/A (XDG vars not used) |

**State Directory** (where plugins write budget/provider data):

| Platform | Default Path | Custom Path (via environment variable) |
|----------|--------------|----------------------------------------|
| Linux | `~/.local/state/oclitellmac/` | `$XDG_STATE_HOME/oclitellmac/` |
| macOS | `~/.local/state/oclitellmac/` | N/A (XDG vars not used) |
| Windows | `C:\Users\<username>\.local\state\oclitellmac\` | N/A (XDG vars not used) |

**Linux Custom Paths Example**:
```bash
# Override default XDG directories
export XDG_CONFIG_HOME="$HOME/my-config"
export XDG_STATE_HOME="$HOME/my-state"

# Plugin will use:
# - Config: ~/my-config/oclitellmac/server.json
# - State: ~/my-state/oclitellmac/
```

**Note**: The plugin uses Unix-style paths (`.config`, `.local/state`) on all platforms for consistency with OpenCode core. See [`PATH-STRATEGY.md`](PATH-STRATEGY.md) for detailed rationale.

## Verification Steps

### 1. Check Plugin Loading

```bash
# Check OpenCode logs for plugin loading messages
# Should see:
# - "Loaded configuration from ..."
# - "Fetching models for ..."
# - "Provider injection complete: ..."
# - "Started budget tracking for ..."
```

### 2. Verify Provider Injection

In OpenCode, check that your LiteLLM models are available:
- Open model picker
- Look for providers with your configured `providerKey`
- Verify models are listed

### 3. Verify Budget Tracking

**Linux/macOS**:
```bash
# Check budget files are being created (default path)
ls -lh ~/.local/state/oclitellmac/key-info/

# View budget data
cat ~/.local/state/oclitellmac/key-info/<provider-key>.json

# If using custom XDG_STATE_HOME (Linux only)
ls -lh "$XDG_STATE_HOME/oclitellmac/key-info/"
```

**Windows** (PowerShell):
```powershell
# Check budget files
dir $HOME\.local\state\oclitellmac\key-info\

# View budget data
cat $HOME\.local\state\oclitellmac\key-info\<provider-key>.json
```

Expected structure:
```json
{
  "providerKey": "my-litellm",
  "providerName": "My LiteLLM Proxy",
  "fetchedAt": 1778533883000,
  "keyInfo": {
    "key": "...",
    "info": {
      "key_alias": "...",
      "spend": 2.19,
      "max_budget": 50,
      "budget_duration": "7d",
      "budget_reset_at": "2026-05-18T...",
      "expires": "2026-07-12T..."
    }
  }
}
```

### 4. Verify TUI Display

In OpenCode TUI sidebar, look for:
- "Key Info" section
- Provider cards showing:
  - Provider name
  - Progress bar
  - Budget usage ($X / $Y)
  - Percentage used
  - Remaining budget
  - Reset schedule
  - Fetch timestamp (absolute, with timezone)

## Troubleshooting

For common issues and solutions, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

Quick diagnostics:
- **Server plugin not loading** → Check config file exists and is valid JSON
- **TUI shows "Waiting for server..."** → Verify budget files exist in state directory
- **Models not appearing** → Check endpoint is enabled and category filtering settings
- **Budget not updating** → Verify `/key/info` endpoint is accessible

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for:
- Build process and dependency management
- Import style conventions
- Type checking instructions
- Testing procedures
