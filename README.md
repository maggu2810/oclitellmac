# oclitellmac

**OpenCode LiteLLM Auto-Config** - Unified plugin for automatic LiteLLM proxy configuration and budget tracking.

## Overview

The `oclitellmac` plugin combines server and TUI functionality in a single package to provide seamless integration with LiteLLM proxy endpoints. The plugin consists of two entry points:

- **`oclitellmac/server`** - Server plugin that automatically discovers and configures LiteLLM models as OpenCode providers
- **`oclitellmac/tui`** - TUI plugin that displays budget and usage information in the OpenCode sidebar

### Architecture

The plugin follows a **producer-consumer architecture**:

1. **Server Plugin (Producer)**: 
   - Fetches model lists from LiteLLM endpoints
   - Polls budget data from `/key/info` API
   - Writes data to local state files (`~/.local/state/oclitellmac/`)
   - Injects providers into OpenCode configuration

2. **TUI Plugin (Consumer)**:
   - Reads budget files written by server plugin
   - Displays real-time budget information in sidebar
   - **Does NOT call LiteLLM APIs directly** - purely file-based

This separation ensures the TUI has zero network overhead and can display budget information instantly from cached data.

## Features

### Server Plugin
- 🚀 **Zero-config provider setup** - No manual `opencode.json` editing
- 🔗 **Multiple endpoints** - Configure multiple LiteLLM proxies at once
- 🔑 **Automatic authentication** - API keys stored in plugin config
- 📊 **Model discovery** - Fetches models from LiteLLM `/public/model_hub` and `/v1/model/info`
- 🎯 **Smart model filtering** - Blacklists non-chat models by default
- 💾 **Smart caching** - Falls back to cached data if endpoints are unreachable
- 💰 **Budget tracking** - Monitors usage via `/key/info` endpoint

### TUI Plugin
- 📊 **Real-time budget display** - Shows spend, limit, and remaining budget
- 🔄 **File-based updates** - Reads cached data from server plugin
- ⚡ **Instant updates** - File watcher detects changes immediately
- 🎨 **Color-coded alerts** - Green (healthy), yellow (warning), red (danger)
- 📦 **Multiple providers** - Displays all configured LiteLLM endpoints
- 🚫 **No API calls** - Zero network overhead, reads local files only

## Installation

See [**INSTALL.md**](INSTALL.md) for installation instructions.

## Configuration

See [**CONFIGURATION.md**](CONFIGURATION.md) for server configuration reference.

## Path Management

The plugin uses the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) for organizing user data. This provides XDG compliance on Linux while maintaining consistent paths across all platforms.

### Default Paths

**Configuration** (server plugin):
```
~/.config/oclitellmac/server.json
```

**State Data** (provider cache and budget data):
```
~/.local/state/oclitellmac/
├── providers/          # Cached provider & model data
│   ├── litellm-prod.json
│   └── litellm-dev.json
└── key-info/           # Budget/usage data (for TUI display)
    ├── litellm-prod.json
    └── litellm-dev.json
```

### Why Unix-Style Paths Everywhere?

The plugin uses Unix-style paths (`.config`, `.local/state`) on all platforms to:
- ✅ Maintain consistency with OpenCode core
- ✅ Provide XDG compliance on Linux
- ✅ Simplify documentation (same paths everywhere)
- ✅ Allow easy path overrides via environment variables (Linux)

On Linux, you can override the default paths using `XDG_CONFIG_HOME` and `XDG_STATE_HOME` environment variables. On macOS and Windows, the plugin uses the default Unix-style paths shown above.

See [**CONFIGURATION.md**](CONFIGURATION.md) for platform-specific path details and [`PATH-STRATEGY.md`](PATH-STRATEGY.md) for detailed rationale.

### Budget Data Format

The TUI plugin reads JSON files with this structure:

```json
{
  "providerKey": "litellm-prod",
  "providerName": "LiteLLM Production",
  "fetchedAt": 1736647260000,
  "keyInfo": {
    "key": "...",
    "info": {
      "key_alias": "user-prod-key",
      "spend": 45.67,
      "max_budget": 100.00,
      "budget_duration": "monthly",
      "budget_reset_at": "2026-02-01T00:00:00Z",
      "expires": "2027-01-01T00:00:00Z"
    }
  }
}
```

## TUI Display

The TUI plugin adds a "Key Info" section to the OpenCode sidebar:

### Provider Card Example

```
┌─────────────────────────┐
│ LiteLLM Production      │
│ ████████████░░░░░░░░    │
│ $45.67 / $100.00        │
│ 45.7% used              │
│ $54.33 remaining        │
│ Resets in 15d (monthly) │
│ Fetched 5/11/26, 2:45PM │
└─────────────────────────┘
```

### Color Coding

Budget usage is color-coded for quick visual status:

- 🟢 **Green** (< 75% used) - Healthy, plenty of budget remaining
- 🟡 **Yellow** (75-90% used) - Warning, approaching limit
- 🔴 **Red** (> 90% used) - Danger zone, budget nearly exhausted

### Timestamp Display

- Displays absolute timestamps in local timezone
- Format: "5/11/2026, 2:45:23 PM"
- No periodic UI refresh needed (timestamps are static)

## How It Works

### Startup Flow

1. **Server plugin loads** (on OpenCode startup)
   - Reads `~/.config/oclitellmac/server.json`
   - Fetches models from each enabled endpoint
   - Caches results to `~/.local/state/oclitellmac/providers/`
   - Injects providers into OpenCode (no `opencode.json` editing needed)
   - Starts budget tracking (polls `/key/info` every 60 seconds)

2. **TUI plugin loads** (on TUI startup)
   - Scans `~/.local/state/oclitellmac/key-info/` directory
   - Loads all budget files
   - Displays provider cards in sidebar
   - Starts file watcher for instant updates

### Runtime Flow

1. **Budget tracking** (continuous)
   - Server polls `/key/info` every 60 seconds
   - Server fetches budget after each chat message
   - Server writes to `~/.local/state/oclitellmac/key-info/`

2. **TUI updates** (event-driven)
   - File watcher detects budget file changes
   - TUI reloads and re-renders provider cards
   - Updates appear within ~100ms

### Fallback Behavior

If an endpoint is unreachable:
- Server falls back to cached provider data (if `fallbackToCache: true`)
- Logs warning message
- Provider remains available with cached models
- TUI continues displaying last known budget data

## Troubleshooting

### Server Plugin Not Loading

**Symptoms**: No providers appear in model picker

**Solutions**:
1. Check configuration file exists: `~/.config/oclitellmac/server.json`
2. Verify JSON syntax is valid: `jq . < ~/.config/oclitellmac/server.json`
3. Check OpenCode logs for `[oclitellmac]` error messages
4. Ensure at least one endpoint has `"enabled": true`

### Endpoint Unreachable

**Symptoms**: "Using cached data" warnings in logs

**Solutions**:
- Plugin will fall back to cached data if `fallbackToCache: true`
- Check `~/.local/state/oclitellmac/providers/` for cached data
- Verify endpoint URL and API key are correct
- Test endpoint manually: `curl https://your-proxy.example.com/public/model_hub`

### Models Not Appearing

**Symptoms**: Provider appears but no models listed

**Solutions**:
- Ensure endpoint is enabled: `"enabled": true`
- Check that LiteLLM proxy is accessible
- Verify non-chat models aren't accidentally blacklisted
- Restart OpenCode after configuration changes

### TUI Shows "Waiting for server..."

**Symptoms**: No budget cards displayed in sidebar

**Solutions**:
1. Verify server plugin is loaded: Check for `[oclitellmac]` in logs
2. Check budget files exist: `ls ~/.local/state/oclitellmac/key-info/`
3. Verify budget files are valid JSON: `jq . < ~/.local/state/oclitellmac/key-info/*.json`
4. Wait 60 seconds for initial budget fetch
5. Restart OpenCode to reset both plugins

### Budget Not Updating

**Symptoms**: TUI shows stale budget data

**Solutions**:
1. Check server plugin is running: Look for `[oclitellmac]` logs
2. Verify `/key/info` endpoint is accessible: `curl -H "Authorization: Bearer sk-..." https://your-proxy/key/info`
3. Check file timestamps: `ls -lh ~/.local/state/oclitellmac/key-info/`
4. Verify file watcher is working: Send a chat message and check if TUI updates
5. Restart OpenCode to reset file watcher

## Technical References

- **Installation Guide**: See [`INSTALL.md`](INSTALL.md) for step-by-step setup and verification
- **Configuration Reference**: See [`CONFIGURATION.md`](CONFIGURATION.md) for detailed server.json options
- **Server Plugin**: See [`server/README.md`](server/README.md) for implementation details
- **Server Architecture**: See [`server/ARCHITECTURE.md`](server/ARCHITECTURE.md) for modular pipeline design
- **TUI Plugin**: See [`tui/README.md`](tui/README.md) for component structure and file watching

## Requirements

- OpenCode with plugin support
- LiteLLM proxy endpoint(s)
- Node.js 18+ (for development)

## License

MIT
