# oclitellmac

**OpenCode LiteLLM Auto-Config** - Unified plugin for automatic LiteLLM proxy configuration and budget tracking.

## What It Does

The `oclitellmac` plugin provides seamless integration with LiteLLM proxy endpoints for OpenCode. It automatically discovers models, injects them as OpenCode providers, and displays real-time budget tracking in the sidebar — all with zero manual configuration.

The plugin combines server and TUI functionality: the server plugin fetches models and polls budget data, writing everything to local files; the TUI plugin reads those files and displays budget information with zero network overhead.

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

## Requirements

- OpenCode with plugin support
- LiteLLM proxy endpoint(s)

## Installation

Install the plugin from npm:

```bash
# Global installation (available in all projects)
opencode plugin oclitellmac --global

# Project-local installation
opencode plugin oclitellmac
```

After installation, configure the server plugin (see Configuration section below) and restart OpenCode.

## Configuration

Create a configuration file at `~/.config/oclitellmac/server.json` with your LiteLLM endpoint(s).

### Minimal Configuration

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
  ]
}
```

The `providerName` field is optional but recommended — it controls the display name shown in the OpenCode model picker and TUI sidebar. If omitted, the plugin auto-formats the `providerKey` (e.g., `my-litellm` → `My Llm`).

### Full Configuration Example

```json
{
  "endpoints": [
    {
      "providerKey": "litellm-prod",
      "providerName": "LiteLLM Production",
      "baseUrl": "https://litellm-prod.example.com",
      "apiKey": "sk-prod-key-123",
      "enabled": true
    },
    {
      "providerKey": "litellm-dev",
      "providerName": "LiteLLM Development",
      "baseUrl": "https://litellm-dev.example.com",
      "apiKey": "sk-dev-key-456",
      "enabled": true,
      "enabledCategories": ["embedding"]
    },
    {
      "providerKey": "litellm-staging",
      "providerName": "LiteLLM Staging",
      "baseUrl": "https://litellm-staging.example.com",
      "apiKey": "sk-staging-key-789",
      "enabled": false,
      "enableAllCategories": true
    }
  ],
  "options": {
    "timeout": 30,
    "budgetPollInterval": 60,
    "fallbackToCache": true
  }
}
```

This configuration:
- **litellm-prod**: Chat models only (production environment)
- **litellm-dev**: Chat + embedding models (development environment)
- **litellm-staging**: Disabled (not loaded), but configured for easy enabling
- **Options**: 30s timeout, poll budget every 60s, fall back to cache if unreachable

### Configuration File Location

| Platform | Default Path |
|----------|--------------|
| Linux | `~/.config/oclitellmac/server.json` |
| macOS | `~/.config/oclitellmac/server.json` |
| Windows | `C:\Users\<username>\.config\oclitellmac\server.json` |

On Linux, you can override the default path using the `XDG_CONFIG_HOME` environment variable.

### State Directory

The plugin writes cached data and budget information to:

| Platform | Default Path |
|----------|--------------|
| Linux | `~/.local/state/oclitellmac/` |
| macOS | `~/.local/state/oclitellmac/` |
| Windows | `C:\Users\<username>\.local\state\oclitellmac\` |

On Linux, you can override the default path using the `XDG_STATE_HOME` environment variable.

## Troubleshooting

See the `docs/TROUBLESHOOTING.md` file in the [project repository](https://github.com/maggu2810/oclitellmac) for common issues and solutions.

## Further Documentation

Full documentation including installation guide, configuration reference, path strategy, and development guide is available in the `docs/` directory of the project repository at https://github.com/maggu2810/oclitellmac.

## License

MIT
