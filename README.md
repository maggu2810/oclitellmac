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

### Method 1: GitHub URL (Recommended)

Install directly from GitHub repository:

```bash
# Global installation (available in all projects)
opencode plugin github:maggu2810/oclitellmac --global

# Project-local installation
opencode plugin github:maggu2810/oclitellmac
```

OpenCode will automatically:
- Clone the repository
- Install dependencies
- Register both entry points (`oclitellmac/server`, `oclitellmac/tui`)

### Method 2: Local Development

For plugin development or testing local changes:

```bash
# Clone repository
git clone https://github.com/maggu2810/oclitellmac.git
cd oclitellmac

# Install dependencies
npm install

# Register with OpenCode (use absolute or relative path)
opencode plugin add .
```

### Configure OpenCode

Add both entry points to your `opencode.json`:

```json
{
  "plugin": [
    "oclitellmac/server",
    "oclitellmac/tui"
  ]
}
```

**Note**: When using Method 1 (GitHub URL), OpenCode adds these automatically.

### Configure Server Plugin

Create `~/.config/oclitellmac/server.json`:

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

See `server/config-example.json` for detailed configuration examples.

### Restart OpenCode

The plugins will automatically:
- Load enabled endpoints from config
- Fetch models from LiteLLM endpoints
- Inject providers into OpenCode
- Start budget tracking
- Display budget panels in TUI sidebar

## Configuration

### Endpoint Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseUrl` | string | ✅ | LiteLLM proxy base URL (without `/v1`) |
| `apiKey` | string | ✅ | Bearer token for API authentication |
| `providerKey` | string | ✅ | Unique provider identifier |
| `providerName` | string | ❌ | Display name in OpenCode UI (auto-formatted from `providerKey` if omitted) |
| `enabled` | boolean | ❌ | Default: `true`. Whether to load this endpoint |
| `enabledCategories` | string[] | ❌ | Non-chat model categories to enable (see below) |
| `enableAllCategories` | boolean | ❌ | Default: `false`. Enable all non-chat models |

### Global Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | number | `30` | HTTP request timeout in seconds |
| `budgetPollInterval` | number | `60` | How often to poll `/key/info` in seconds |
| `fallbackToCache` | boolean | `true` | Use cached data if endpoint unreachable |

## Model Category Filtering

By default, the plugin **blacklists non-chat models** to keep the model picker clean. Non-chat models (embeddings, TTS, image generation, etc.) are still fetched, but hidden from the UI.

### Default Behavior (Chat Models Only)

```json
{
  "endpoints": [
    {
      "providerKey": "litellm-prod",
      "baseUrl": "https://litellm.example.com",
      "apiKey": "sk-..."
    }
  ]
}
```

Only chat models appear in the model picker.

### Enable Specific Categories

```json
{
  "endpoints": [
    {
      "providerKey": "litellm-with-embeddings",
      "baseUrl": "https://litellm.example.com",
      "apiKey": "sk-...",
      "enabledCategories": ["embedding", "audio_speech"]
    }
  ]
}
```

Enables embedding and TTS models while keeping others blacklisted.

### Enable All Non-Chat Models

```json
{
  "endpoints": [
    {
      "providerKey": "litellm-all-models",
      "baseUrl": "https://litellm.example.com",
      "apiKey": "sk-...",
      "enableAllCategories": true
    }
  ]
}
```

Shows **all** models in the picker.

### Available Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `embedding` | Text embedding models | `text-embedding-ada-002`, `text-embedding-3-large` |
| `audio_speech` | Text-to-speech (TTS) | `tts-1`, `tts-1-hd` |
| `transcription` | Speech-to-text (STT) | `whisper-1` |
| `image_generation` | Image generation | `dall-e-3`, `stable-diffusion-xl` |
| `video_generation` | Video generation | Model-specific |
| `ocr` | Document analysis / OCR | Model-specific |
| `ranking` | Reranking models | Model-specific |
| `router` | Model routing / moderation | Model-specific |

**Note**: Chat models are **always enabled** regardless of category settings.

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

### Platform-Specific Paths

**Linux (Default)**:
- Config: `~/.config/oclitellmac/server.json`
- State: `~/.local/state/oclitellmac/`

**Linux (Custom XDG Variables)**:
```bash
export XDG_CONFIG_HOME="$HOME/my-config"
export XDG_STATE_HOME="$HOME/my-state"
```
- Config: `~/my-config/oclitellmac/server.json`
- State: `~/my-state/oclitellmac/`

**macOS** (Unix-style paths):
- Config: `~/.config/oclitellmac/server.json`
- State: `~/.local/state/oclitellmac/`

**Windows** (Unix-style paths):
- Config: `C:\Users\username\.config\oclitellmac\server.json`
- State: `C:\Users\username\.local\state\oclitellmac\`

### XDG Environment Variables

The plugin respects these environment variables on Linux:

- **`XDG_CONFIG_HOME`**: Override config directory (default: `~/.config`)
- **`XDG_STATE_HOME`**: Override state directory (default: `~/.local/state`)

**Note**: These environment variables are only meaningful on Linux. On macOS and Windows, the plugin uses the default Unix-style paths (matching OpenCode core behavior).

### Why Unix-Style Paths Everywhere?

The plugin uses Unix-style paths (`.config`, `.local/state`) on all platforms to:
- ✅ Maintain consistency with OpenCode core
- ✅ Provide XDG compliance on Linux
- ✅ Simplify documentation (same paths everywhere)
- ✅ Allow easy path overrides via environment variables (Linux)

See `PATH-STRATEGY.md` for detailed rationale and alternative approaches considered.

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

## Development

### Type Check

```bash
cd plugins/oclitellmac
npx tsc --noEmit
```

**Note**: Errors about missing Node.js types and peer dependencies are expected (runtime dependencies provided by OpenCode).

### File Structure

```
plugins/oclitellmac/
├── package.json              # Merged package with dual exports
├── tsconfig.json             # TypeScript config for both plugins
├── README.md                 # This file (user guide)
├── INSTALL.md                # Installation and testing guide
├── server/                   # Server plugin
│   ├── src/                  # Server source code
│   ├── README.md            # Server technical reference
│   ├── ARCHITECTURE.md      # Server architecture details
│   ├── IMPLEMENTATION.md    # Server implementation details
│   ├── VERIFICATION.md      # Server testing checklist
│   └── config-example.json  # Server config example
└── tui/                      # TUI plugin
    ├── src/                  # TUI source code
    └── README.md            # TUI technical reference
```

## Technical References

- **Server Plugin**: See `server/README.md` for implementation details
- **Server Architecture**: See `server/ARCHITECTURE.md` for modular pipeline design
- **TUI Plugin**: See `tui/README.md` for component structure and file watching
- **Installation Guide**: See `INSTALL.md` for step-by-step setup and verification

## Requirements

- OpenCode with plugin support
- LiteLLM proxy endpoint(s)
- Node.js 18+ (for development)

## License

MIT
