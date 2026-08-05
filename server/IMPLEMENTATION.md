# Server Plugin - Implementation Summary

## ✅ Plugin Successfully Created

The server plugin (`oclitellmac/server`) has been fully implemented and is ready for use!

## 📁 File Structure

```
plugins/oclitellmac/server/
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
├── ARCHITECTURE.md
├── IMPLEMENTATION.md
├── VERIFICATION.md
├── config-example.json          # Example configuration
└── src/
    ├── index.ts                 # Main plugin entry — config hook + chat.message hook
    ├── config.ts                # Zod configuration schema and loader
    ├── paths.ts                 # XDG-compliant config/state path resolution
    ├── fetch.ts                 # LiteLLM API client (model hub, model info, key info)
    ├── categorize.ts             # Model category detection (chat, embedding, TTS, etc.)
    ├── map.ts                   # Field mapping (LiteLLM → OpenCode ModelConfig)
    ├── build.ts                 # ModelConfig entry construction
    ├── filter.ts                # Blacklist generation for non-chat models
    ├── transform.ts             # Pipeline orchestration (fetch → categorize → map → build)
    ├── state.ts                 # State management with file locking
    └── budget.ts                # Budget tracking (polling + event-based)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full pipeline data flow and
[docs/litellm-integration/shared-pipeline-architecture.md](../../../docs/litellm-integration/shared-pipeline-architecture.md)
for the architecture shared with `tools/config-generator`.

## 🚀 Installation Steps

### 1. Install Dependencies

```bash
cd /path/to/plugins/oclitellmac
bun install
```

### 2. Create Configuration File

```bash
# Create config directory
mkdir -p ~/.config/oclitellmac

# Copy example config
cp server/config-example.json ~/.config/oclitellmac/server.json

# Edit with your LiteLLM endpoints
nano ~/.config/oclitellmac/server.json
```

**Example configuration:**
```json
{
  "endpoints": [
    {
      "baseUrl": "https://your-litellm-proxy.example.com",
      "apiKey": "sk-your-api-key-here",
      "providerName": "My LiteLLM",
      "providerKey": "my-litellm",
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

See [CONFIGURATION.md](../docs/CONFIGURATION.md) for the full field
reference, including optional `enabledCategories`, `enableAllCategories`,
`providerOptions` (timeout/chunkTimeout/headerTimeout/setCacheKey), and
`env`.

### 3. Add Plugin to OpenCode

```bash
opencode plugin add /path/to/plugins/oclitellmac
```

Add to your `opencode.json`:
```json
{
  "plugin": ["oclitellmac/server", "oclitellmac/tui"]
}
```

### 4. Restart OpenCode

The plugin will automatically:
- ✅ Load all enabled endpoints from `~/.config/oclitellmac/server.json`
- ✅ Fetch models from LiteLLM `/public/model_hub` and `/v1/model/info`
- ✅ Cache results to `~/.local/state/oclitellmac/providers/`
- ✅ Inject providers into OpenCode (no manual `opencode.json` editing needed!)
- ✅ Start budget tracking (polls `/key/info` every 60 seconds)

## 🎯 Key Features Implemented

### ✅ 1. Multiple Endpoint Support
- Configure N LiteLLM proxies in one config file
- Each endpoint becomes a separate OpenCode provider
- Enable/disable endpoints without deletion

### ✅ 2. Automatic Provider Injection
- Uses `config` hook to inject providers dynamically
- No manual `opencode.json` editing required
- API keys embedded directly in provider options

### ✅ 3. Model Discovery & Field Mapping
- Fetches from `/public/model_hub` (public, no auth)
- Fetches from `/v1/model/info` (authenticated, detailed metadata)
- Maps LiteLLM fields to OpenCode `ModelConfig` schema
  (`tool_call`, `attachment`, `reasoning`, `temperature`, `cost`, `limit`,
  `modalities`, `status`, `variants`) via the modular
  `categorize.ts` → `map.ts` → `build.ts` → `transform.ts` pipeline
- Converts LiteLLM's per-token costs to OpenCode's per-million-token
  convention (see [CONFIGURATION.md](../docs/CONFIGURATION.md))
- Surfaces LiteLLM's reasoning-effort support as OpenCode `variants`

### ✅ 4. Category Filtering
- Non-chat models (embedding, TTS, image generation, etc.) are blacklisted
  by default via `filter.ts`
- Opt in per-category with `enabledCategories`, or all at once with
  `enableAllCategories`

### ✅ 5. Smart Caching & Fallback
- Caches provider data to `~/.local/state/oclitellmac/providers/`
- Falls back to cached data if endpoint unreachable
- Logs clear warnings when using cached data

### ✅ 6. Budget Tracking
- Polls `/key/info` every 60 seconds (configurable)
- Fetches after each chat message (redundant for cost tracking)
- Stores data in `~/.local/state/oclitellmac/key-info/`
- File locking prevents concurrent write collisions

### ✅ 7. File Locking
- `StateManager` (`state.ts`) implements lock-based write serialization
- Prevents race conditions when multiple sources write simultaneously
- Separate locks for provider cache and budget data

### ✅ 8. Comprehensive Logging
- Logs via `input.client.app.log()` (OpenCode's structured logging)
- Clear `[oclitellmac-server]` service tag for easy filtering
- Logs successes, errors, and fallback behavior

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenCode Startup                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  oclitellmac/server plugin loads (config hook)               │
│  1. Reads ~/.config/oclitellmac/server.json                  │
│  2. For each enabled endpoint:                               │
│     - Fetches /public/model_hub + /v1/model/info in parallel │
│     - transformModels(): categorize → map → build per model  │
│     - Caches to ~/.local/state/oclitellmac/providers/        │
│     - buildBlacklist() for non-chat models                   │
│     - Injects provider via config hook                       │
│     - Starts budget tracking                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenCode Runtime                                            │
│  - Providers available in model picker                       │
│  - Models selectable for chat                                │
│  - API keys auto-injected for requests                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Budget Tracking (Continuous)                                │
│  1. Every 60 seconds: Poll /key/info for all providers       │
│  2. After each message (chat.message hook): Fetch /key/info  │
│  3. Store to ~/.local/state/oclitellmac/key-info/            │
│     (with file locking)                                      │
└─────────────────────────────────────────────────────────────┘
```

## 📂 State Directory Structure

After plugin runs, the following structure is created:

```
~/.local/state/oclitellmac/
├── providers/
│   ├── my-litellm.json          # Cached provider & models
│   └── litellm-prod.json
└── key-info/
    ├── my-litellm.json          # Budget/usage data
    └── litellm-prod.json
```

**Provider cache format** (`providers/<key>.json`):
```json
{
  "providerKey": "my-litellm",
  "baseUrl": "https://litellm.example.com",
  "fetchedAt": 1736647200000,
  "models": {
    "gpt-4": {
      "id": "gpt-4",
      "name": "gpt-4",
      "status": "active",
      "tool_call": true,
      "attachment": true,
      "temperature": true,
      "modalities": {
        "input": ["text", "image"],
        "output": ["text"]
      },
      "cost": {
        "input": 30,
        "output": 60
      },
      "limit": {
        "context": 8192,
        "input": 8192,
        "output": 4096
      }
    }
  },
  "categories": {
    "gpt-4": "chat"
  }
}
```

**Note**: `cost.input` / `cost.output` are USD per **million** tokens (the
OpenCode/models.dev convention), not LiteLLM's raw USD-per-token value — see
[CONFIGURATION.md](../docs/CONFIGURATION.md) for the conversion.

**Budget data format** (`key-info/<key>.json`):
```json
{
  "providerKey": "my-litellm",
  "providerName": "My LiteLLM",
  "fetchedAt": 1736647260000,
  "keyInfo": {
    "key_alias": "user-key",
    "spend": 45.67,
    "max_budget": 100.00,
    "budget_remaining": 54.33,
    "budget_reset_at": "2026-02-01T00:00:00Z"
  }
}
```

## 🔧 Configuration Options

### Endpoint Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseUrl` | string | ✅ | LiteLLM proxy base URL (without `/v1`) |
| `apiKey` | string | ✅ | Bearer token for API authentication |
| `providerKey` | string | ✅ | Unique provider identifier |
| `providerName` | string | ❌ | Display name in OpenCode UI (auto-formatted from `providerKey` if omitted) |
| `enabled` | boolean | ❌ | Default: `true`. Whether to load this endpoint |
| `enabledCategories` | string[] | ❌ | Non-chat model categories to enable |
| `enableAllCategories` | boolean | ❌ | Default: `false`. Enable all non-chat models |
| `providerOptions` | object | ❌ | Forwarded into `options`: `timeout`, `chunkTimeout`, `headerTimeout`, `setCacheKey` |
| `env` | string[] | ❌ | Env var names OpenCode checks for the API key (top-level, sibling of `options`) |

### Global Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | number | `30` | HTTP request timeout in seconds |
| `budgetPollInterval` | number | `60` | How often to poll `/key/info` in seconds |
| `fallbackToCache` | boolean | `true` | Use cached data if endpoint unreachable |

Full reference: [CONFIGURATION.md](../docs/CONFIGURATION.md)

## 🐛 Troubleshooting

### Plugin not loading

1. Check logs for `[oclitellmac-server]` entries
2. Verify config file exists: `~/.config/oclitellmac/server.json`
3. Validate JSON syntax (use `jq . < server.json`)
4. Check at least one endpoint is enabled

### Models not appearing

1. Verify endpoint URL is accessible: `curl https://your-proxy.example.com/public/model_hub`
2. Check API key is valid: `curl -H "Authorization: Bearer sk-..." https://your-proxy.example.com/v1/model/info`
3. Look for error logs with `[oclitellmac-server]` prefix
4. Check if cached data exists: `ls ~/.local/state/oclitellmac/providers/`

### Budget data not updating

1. Verify `/key/info` endpoint is accessible
2. Check file permissions on `~/.local/state/oclitellmac/key-info/`
3. Look for "Failed to fetch budget" in logs
4. Ensure budget tracking started successfully (check logs for "Started budget tracking")

## 🎯 Next Steps

### Immediate
1. ✅ Install dependencies: `bun install`
2. ✅ Create configuration: `~/.config/oclitellmac/server.json`
3. ✅ Add plugin to OpenCode
4. ✅ Restart OpenCode
5. ✅ Verify providers appear in model picker

### Future Enhancements
- Configuration file watcher for hot-reload (no restart needed)
- Health checks for endpoint availability
- Retry logic with exponential backoff
- Incremental/delta-based cache updates

## 📝 Technical Implementation Details

### Design Patterns Used

1. **Config Hook Injection Pattern** (from BlakeHastings plugin)
   - Directly mutates `config.provider` object
   - No user `opencode.json` required
   - Clean, automatic provider registration

2. **File Locking via Promise Serialization**
   - Prevents concurrent writes using `Map<key, Promise>`
   - No external lock file dependencies
   - Automatic cleanup on completion

3. **Fallback Caching Pattern**
   - Always cache successful fetches
   - Fall back to cache on failure
   - Log clearly when using cached data

4. **Fire-and-Forget Budget Fetching**
   - Non-blocking budget updates
   - Error handling within async operations
   - No impact on chat message performance

### Code Quality

- ✅ TypeScript with strict mode
- ✅ Clear function documentation
- ✅ Consistent error handling
- ✅ Comprehensive logging
- ✅ Type-safe configuration with `zod`
- ✅ Modular pipeline architecture (11 source files), shared design with
  `tools/config-generator` (see
  [shared-pipeline-architecture.md](../../../docs/litellm-integration/shared-pipeline-architecture.md))

## 🎉 Success!

The server plugin is complete and in active use.

**Implementation**:
- 11 source files (`~/plugins/oclitellmac/server/src/`)
- Full LiteLLM integration (model discovery, field mapping, category filtering)
- Cost-unit-correct pricing display and tracking
- Reasoning-effort variant support
- Smart caching and fallback
- Budget tracking infrastructure
- Comprehensive documentation
