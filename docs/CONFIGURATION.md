# Configuration Reference

This document provides detailed configuration options for the oclitellmac server plugin.

**Quick Links:**
- [Installation Guide](INSTALL.md) - Setup and verification steps
- [Feature Overview](../README.md) - What oclitellmac can do
- [Example Configuration](../server/config-example.json) - Complete configuration examples

## Table of Contents

1. [Configuration File Location](#configuration-file-location)
2. [Quick Start Configuration](#quick-start-configuration)
3. [Endpoint Configuration Reference](#endpoint-configuration-reference)
4. [Global Options Reference](#global-options-reference)
5. [Model Category Filtering](#model-category-filtering)
6. [Multiple Endpoints Example](#multiple-endpoints-example)
7. [Advanced Configuration](#advanced-configuration)

## Configuration File Location

The server plugin reads its configuration from `server.json` in the XDG config directory.

### Default Paths

**Linux (Default)**:
```
~/.config/oclitellmac/server.json
```

**Linux (Custom XDG Variables)**:
```bash
export XDG_CONFIG_HOME="$HOME/my-config"
export XDG_STATE_HOME="$HOME/my-state"
```
- Config: `~/my-config/oclitellmac/server.json`
- State: `~/my-state/oclitellmac/`

**macOS** (Unix-style paths):
```
~/.config/oclitellmac/server.json
```

**Windows** (Unix-style paths):
```
C:\Users\username\.config\oclitellmac\server.json
```

### XDG Environment Variables

The plugin respects these environment variables on Linux:

- **`XDG_CONFIG_HOME`**: Override config directory (default: `~/.config`)
- **`XDG_STATE_HOME`**: Override state directory (default: `~/.local/state`)

**Note**: These environment variables are only meaningful on Linux. On macOS and Windows, the plugin uses the default Unix-style paths (matching OpenCode core behavior).

### State Directory

The plugin writes cached data and budget information to:

```
~/.local/state/oclitellmac/
├── providers/          # Cached provider & model data
│   ├── litellm-prod.json
│   └── litellm-dev.json
└── key-info/           # Budget/usage data (for TUI display)
    ├── litellm-prod.json
    └── litellm-dev.json
```

## Quick Start Configuration

Create `~/.config/oclitellmac/server.json` with a minimal configuration:

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

This minimal configuration:
- Connects to a single LiteLLM endpoint
- Uses default options (30s timeout, 60s budget polling, fallback enabled)
- Shows only chat models (non-chat models blacklisted by default)

Restart OpenCode to apply the configuration.

## Endpoint Configuration Reference

Each endpoint in the `endpoints` array supports the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseUrl` | string | ✅ | LiteLLM proxy base URL (without `/v1`) |
| `apiKey` | string | ✅ | Bearer token for API authentication |
| `providerKey` | string | ✅ | Unique provider identifier (used in OpenCode model picker) |
| `providerName` | string | ❌ | Display name in OpenCode UI (auto-formatted from `providerKey` if omitted) |
| `enabled` | boolean | ❌ | Default: `true`. Whether to load this endpoint |
| `enabledCategories` | string[] | ❌ | Non-chat model categories to enable (see [Model Category Filtering](#model-category-filtering)) |
| `enableAllCategories` | boolean | ❌ | Default: `false`. Enable all non-chat models |

### Field Details

#### `baseUrl` (required)

The base URL of your LiteLLM proxy **without** the `/v1` suffix.

**Examples:**
```json
"baseUrl": "https://litellm.example.com"           // ✅ Correct
"baseUrl": "https://litellm.example.com/v1"        // ❌ Wrong (don't include /v1)
"baseUrl": "https://litellm.example.com:8080"      // ✅ Correct (custom port)
```

#### `apiKey` (required)

Bearer token for authenticating with the LiteLLM proxy. This is typically a key created in LiteLLM's key management system.

```json
"apiKey": "sk-1234567890abcdef"
```

The plugin automatically injects this key into all OpenCode requests for models from this provider.

#### `providerKey` (required)

Unique identifier for this provider. Used internally by OpenCode and displayed in the model picker.

**Requirements:**
- Must be unique across all endpoints
- Use lowercase with hyphens (e.g., `litellm-prod`, `litellm-dev`)

```json
"providerKey": "litellm-prod"
```

#### `providerName` (optional)

Human-readable display name shown in OpenCode UI. If omitted, the plugin auto-formats `providerKey`:
- `litellm-prod` → `Litellm Prod`
- `my-llm-api` → `My Llm Api`

```json
"providerName": "LiteLLM Production"
```

#### `enabled` (optional)

Set to `false` to temporarily disable an endpoint without removing it from the config.

```json
"enabled": false  // Endpoint ignored, models not loaded
```

Default: `true`

#### `enabledCategories` (optional)

Array of non-chat model categories to enable. See [Model Category Filtering](#model-category-filtering) for details.

```json
"enabledCategories": ["embedding", "audio_speech"]
```

#### `enableAllCategories` (optional)

Set to `true` to enable all model categories (chat, embedding, TTS, image generation, etc.).

```json
"enableAllCategories": true
```

Default: `false` (only chat models enabled)

#### `providerOptions` (optional)

Forwarded verbatim into the injected provider's `options` block, alongside
`baseURL` and `apiKey`. See OpenCode's provider config schema
(`packages/core/src/v1/config/provider.ts` — see
[docs/litellm-integration/source-map.md](../../../docs/litellm-integration/source-map.md)
for the exact commit) for full field semantics.

```json
"providerOptions": {
  "timeout": 600000,
  "chunkTimeout": 30000,
  "headerTimeout": 10000,
  "setCacheKey": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `timeout` | number \| `false` | Request timeout in milliseconds. `false` disables it. |
| `chunkTimeout` | number | Timeout in milliseconds between streamed SSE chunks. |
| `headerTimeout` | number \| `false` | Timeout in milliseconds to wait for response headers. `false` disables it. |
| `setCacheKey` | boolean | Ensure a cache key is always set for this provider. |

All fields are optional and omitted from the generated provider config when
not set.

#### `env` (optional)

Env var names OpenCode checks for the API key. This is a top-level provider
field (sibling of `options`), not nested inside `providerOptions`. Since the
plugin already injects `apiKey` directly, this is rarely needed — mainly
useful as a fallback for tooling that reads env vars directly.

```json
"env": ["LITELLM_API_KEY"]
```

## Global Options Reference

The optional `options` object configures global plugin behavior:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | number | `30` | HTTP request timeout in seconds |
| `budgetPollInterval` | number | `60` | How often to poll `/key/info` in seconds |
| `fallbackToCache` | boolean | `true` | Use cached data if endpoint unreachable |

### Configuration Example

```json
{
  "endpoints": [ /* ... */ ],
  "options": {
    "timeout": 30,
    "budgetPollInterval": 60,
    "fallbackToCache": true
  }
}
```

### Option Details

#### `timeout`

Maximum time (in seconds) to wait for LiteLLM API responses.

**Recommendations:**
- **Fast local network**: `10-15` seconds
- **Internet endpoints**: `30` seconds (default)
- **Slow/unreliable connections**: `60-90` seconds

#### `budgetPollInterval`

How often (in seconds) to poll the `/key/info` endpoint for budget updates.

**Recommendations:**
- **High-frequency usage**: `30-60` seconds (default: 60)
- **Low-frequency usage**: `300` seconds (5 minutes)
- **Budget tracking disabled**: Set to a very high value (e.g., `86400` = 1 day)

**Note**: The plugin also fetches budget data after each chat message, so this interval is mainly for passive updates.

#### `fallbackToCache`

If `true`, the plugin uses cached model data when an endpoint is unreachable.

**Behavior:**
- `true` (default): Provider remains available with cached models, logs warning
- `false`: Provider fails to load if endpoint unreachable

**Recommendations:**
- **Development/testing**: `true` (more forgiving)
- **Production**: `true` (prevents outages from affecting model availability)
- **Always fresh data**: `false` (requires endpoint to be reachable)

## Model Category Filtering

By default, the plugin **blacklists non-chat models** to keep the model picker clean. Non-chat models (embeddings, TTS, image generation, etc.) are still fetched and cached, but hidden from the OpenCode UI.

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

To enable specific non-chat model categories:

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

This configuration:
- ✅ Enables: Chat models, embedding models, TTS models
- ❌ Blacklists: Image generation, transcription, video, OCR, ranking, router

### Enable All Non-Chat Models

To show **all** models in the picker:

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

### Per-Endpoint Category Filtering

You can configure different category filters for each endpoint:

```json
{
  "endpoints": [
    {
      "providerKey": "litellm-chat-only",
      "baseUrl": "https://chat.example.com",
      "apiKey": "sk-..."
      // No categories specified → chat models only
    },
    {
      "providerKey": "litellm-with-embeddings",
      "baseUrl": "https://embeddings.example.com",
      "apiKey": "sk-...",
      "enabledCategories": ["embedding"]
    },
    {
      "providerKey": "litellm-all",
      "baseUrl": "https://all.example.com",
      "apiKey": "sk-...",
      "enableAllCategories": true
    }
  ]
}
```

## Multiple Endpoints Example

Configure multiple LiteLLM proxies with different settings:

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

## Advanced Configuration

### Tuning Timeout for Slow Connections

If you experience frequent timeouts with a slow or high-latency endpoint:

```json
{
  "endpoints": [
    {
      "providerKey": "slow-endpoint",
      "baseUrl": "https://slow.example.com",
      "apiKey": "sk-..."
    }
  ],
  "options": {
    "timeout": 90  // Increased from default 30s
  }
}
```

### Aggressive Budget Polling

For high-frequency usage where you need near-real-time budget tracking:

```json
{
  "options": {
    "budgetPollInterval": 30  // Poll every 30 seconds instead of 60
  }
}
```

**Warning**: More frequent polling increases API load. The plugin already fetches budget after each chat message, so this is mainly for passive monitoring.

### Disable Fallback for Testing

To ensure your configuration always uses live data (useful for testing):

```json
{
  "options": {
    "fallbackToCache": false  // Fail if endpoint unreachable
  }
}
```

With this setting, the plugin will fail to load providers if the endpoint is down, rather than using cached data.

### Debugging Configuration

To test a new endpoint without affecting existing ones:

1. Add the new endpoint with `enabled: false`
2. Restart OpenCode (nothing changes)
3. Set `enabled: true` for the new endpoint
4. Restart OpenCode again (new endpoint loads)
5. Check logs for errors
6. If issues occur, set `enabled: false` and investigate

```json
{
  "endpoints": [
    {
      "providerKey": "existing-prod",
      "baseUrl": "https://prod.example.com",
      "apiKey": "sk-prod",
      "enabled": true
    },
    {
      "providerKey": "new-test-endpoint",
      "baseUrl": "https://test.example.com",
      "apiKey": "sk-test",
      "enabled": false  // Start disabled for testing
    }
  ]
}
```

## See Also

- [Installation Guide](INSTALL.md) - Setup and verification
- [README.md](../README.md) - Features and architecture
- [server/config-example.json](../server/config-example.json) - Complete configuration examples
- [PATH-STRATEGY.md](PATH-STRATEGY.md) - Path management rationale
