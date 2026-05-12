# Installation and Testing Guide

## Quick Start

### Method 1: GitHub URL (Recommended)

Install directly from GitHub:

```bash
# Global installation (available in all projects)
opencode plugin github:maggu2810/oclitellmac --global

# Project-local installation
opencode plugin github:maggu2810/oclitellmac
```

OpenCode automatically:
- Clones the repository
- Installs dependencies
- Registers both entry points

Skip to step 2 (Configure Server Plugin) below.

### Method 2: Local Development

For development or testing local changes:

```bash
# Clone repository
git clone https://github.com/maggu2810/oclitellmac.git
cd oclitellmac

# Install dependencies
npm install

# Register with OpenCode
opencode plugin add .
```

### 1. Configure OpenCode (Local Path Only)

**Note**: GitHub URL installation adds these automatically.

Edit your `~/.config/opencode/opencode.json` (or project-local `opencode.json`):

```json
{
  "plugin": [
    "oclitellmac/server",
    "oclitellmac/tui"
  ]
}
```

### 2. Configure Server Plugin

Create `~/.config/oclitellmac/server.json`:

**Note**: The plugin uses XDG Base Directory paths. On Linux, you can override the config location with `XDG_CONFIG_HOME`:

```bash
# Default location
~/.config/oclitellmac/server.json

# Custom location (Linux only)
export XDG_CONFIG_HOME="$HOME/my-config"
# Config will be at: ~/my-config/oclitellmac/server.json
```

**Configuration content**:

```json
{
  "endpoints": [
    {
      "baseUrl": "https://your-litellm-proxy.example.com",
      "apiKey": "sk-your-api-key",
      "providerKey": "my-litellm",
      "providerName": "My LiteLLM Proxy",
      "enabled": true
    }
  ],
  "options": {
    "timeout": 30,
    "budgetPollInterval": 60,
    "fallbackToCache": true
  }
}
```

See `server/config-example.json` for full configuration options.

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

**Note**: The plugin uses Unix-style paths (`.config`, `.local/state`) on all platforms for consistency with OpenCode core. See `PATH-STRATEGY.md` for detailed rationale.

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

### Server Plugin Not Loading

Check OpenCode logs for:
- "Failed to load config" → Create config file at platform-specific path (see Platform-Specific Paths above)
- "Failed to fetch models" → Check endpoint URL and API key
- Connection timeouts → Increase `timeout` in config

### TUI Shows "Waiting for oclitellmac-server..."

Possible causes:
- Server plugin not running → Check plugin configuration
- No budget files created → Check server logs for errors
- Budget files invalid → Check file format (see Verify Budget Tracking above)
- Wrong state directory → Check platform-specific path (see Platform-Specific Paths above)

### Models Not Appearing

Check:
- Server plugin loaded successfully
- Endpoint returned models (`models` in cache file not empty)
- Category filtering settings (non-chat models blacklisted by default)

## Development

### Type Check

```bash
cd plugins/oclitellmac
npx tsc --noEmit
```

Note: Errors about missing Node.js types and peer dependencies are expected.

### Update Sources

When modifying sources:
1. Edit files in `server/src/` or `tui/src/`
2. Run type check
3. Reload OpenCode to test changes

## File Structure

```
plugins/oclitellmac/
├── package.json              # Merged package with dual exports
├── tsconfig.json             # TypeScript config for both plugins
├── README.md                 # This file
├── INSTALL.md                # Installation guide
├── server/                   # Server plugin
│   ├── src/                  # Server source code
│   ├── README.md            # Server documentation
│   ├── ARCHITECTURE.md      # Server architecture details
│   └── config-example.json  # Server config example
└── tui/                      # TUI plugin
    ├── src/                  # TUI source code
    └── README.md            # TUI documentation
```

## Next Steps

After verifying functionality:
1. Test with multiple LiteLLM endpoints
2. Test category filtering (enable embedding, TTS, etc.)
3. Test file watcher updates (modify budget files manually)
4. Test fallback to cached data (disable endpoint)
5. Archive old separate plugins (`oclitellmac-server`, `oclitellmac-tui`)
