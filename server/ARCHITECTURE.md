# Server Plugin Architecture

**Plugin Type**: Server (v1 plugin API)  
**Entry Point**: `oclitellmac/server`  
**Pattern**: Config hook with runtime provider injection  
**Source**: Adapted from `tools/config-generator` Python tool

---

## Overview

The server plugin (`oclitellmac/server`) automatically configures multiple LiteLLM proxy endpoints as OpenCode providers without requiring manual `opencode.json` editing. It uses a modular pipeline architecture shared with the `config-generator` Python tool.

### Key Design Decisions

1. **External Configuration**: Uses `~/.config/oclitellmac/server.json` (not `opencode.json`) for endpoint management
2. **Runtime Injection**: Mutates OpenCode's config via the `config` hook at startup
3. **Modular Pipeline**: Fetch → Categorize → Map → Build → Filter → Transform
4. **Smart Caching**: Falls back to cached provider data when endpoints are unreachable
5. **Budget Tracking**: Continuous polling + event-driven updates via `chat.message` hook
6. **Category Filtering**: Blacklists non-chat models by default (configurable per endpoint)

---

## Module Structure

```
plugins/oclitellmac/server/src/
├── index.ts           # Plugin entry, config/chat.message hooks
├── config.ts          # Zod schemas, config loading
├── fetch.ts           # HTTP client for LiteLLM endpoints
├── categorize.ts      # Model category detection (chat/embedding/TTS/etc.)
├── map.ts             # Field mapping (LiteLLM → OpenCode ModelConfig)
├── build.ts           # Model entry builder
├── filter.ts          # Blacklist generation for non-chat models
├── transform.ts       # Pipeline orchestration
├── budget.ts          # Budget polling and tracking
└── state.ts           # File-based state management with locking
```

### Module Responsibilities

#### `index.ts` - Plugin Orchestration
- Loads configuration from `~/.config/oclitellmac/server.json`
- Implements `config` hook (injects providers into `opcodeConfig.provider`)
- Implements `chat.message` hook (triggers budget refresh after each message)
- Manages provider injection with caching fallback
- Coordinates budget tracking lifecycle

#### `config.ts` - Configuration Schema
- Defines Zod schemas for validation:
  - `EndpointConfigSchema`: Per-endpoint settings (baseUrl, apiKey, categories, etc.)
  - `ServerConfigSchema`: Global options (timeout, polling interval, caching)
- Loads and validates `server.json`
- Provides typed config interfaces

#### `fetch.ts` - HTTP Client
- `LiteLLMClient` class with three methods:
  - `fetchModelHub()`: GET `/public/model_hub` (no auth)
  - `fetchModelInfo()`: GET `/v1/model/info` (requires Bearer token)
  - `fetchKeyInfo()`: GET `/key/info` (budget data)
- Timeout handling with AbortController
- Error handling with detailed logging

#### `categorize.ts` - Model Classification
- `categorizeModel(name, mode)`: Determines model category
  - Priority: API `mode` field → name heuristics → "chat" fallback
- `NON_CHAT_CATEGORIES`: Set of non-chat categories for filtering
- `CATEGORY_LABEL`: Human-readable category descriptions
- Categories: `chat`, `embedding`, `audio_speech`, `transcription`, `image_generation`, `video_generation`, `ocr`, `ranking`, `router`

#### `map.ts` - Field Mapping
- `mapFlags(hub, info)`: Maps capability flags (tool_call, attachment, reasoning, temperature)
- `mapModalities(hub, info)`: Builds input/output modality arrays
- `mapCost(hub, info)`: Maps cost fields (input, output, cache_read, cache_write, context_over_200k)
- `mapLimit(hub, info)`: Maps token limits (context, input, output)
- Uses `getFirst()` helper to prioritize `/v1/model/info` over `/public/model_hub`

#### `build.ts` - Model Entry Builder
- `buildModelEntry(hub, info, category)`: Constructs OpenCode `ModelConfig` object
- Omits false/empty fields to keep config minimal
- Always includes: `id`, `name`, `modalities`
- Conditionally includes: capability flags (when true), `cost` (when available), `limit` (when available)

#### `filter.ts` - Blacklist Generation
- `buildBlacklist(categories, enabledCategories)`: Returns array of `[modelId, category]` pairs
- Filters models where:
  - Category is in `NON_CHAT_CATEGORIES`
  - Category is NOT in `enabledCategories`
- Stable ordering (by category, then by model ID) for readable output

#### `transform.ts` - Pipeline Orchestration
- `transformModels(hubEntries, infoMap)`: Main pipeline function
- Returns: `{ models: Record<string, any>, categories: Map<string, Category> }`
- Iterates over hub entries, categorizes each model, builds model config

#### `budget.ts` - Budget Tracking
- `BudgetTracker` class:
  - `startTracking(providerKey, client)`: Initiates periodic polling
  - `fetchAndStore(providerKey, client)`: One-time budget fetch
  - `stopTracking(providerKey)`: Cleanup
- Stores budget data to `~/.local/state/oclitellmac/key-info/<providerKey>.json`
- Polling interval configurable via `budgetPollInterval` (default: 60s)

#### `state.ts` - State Management
- `StateManager` class:
  - `saveProviderCache(providerKey, data)`: Write provider/model data with file locking
  - `loadProviderCache(providerKey)`: Read cached provider data
  - `saveBudgetData(providerKey, data)`: Write budget data with file locking
  - `loadBudgetData(providerKey)`: Read cached budget data
- Uses `fs.promises` with exclusive locking to prevent write collisions
- Directories:
  - `~/.local/state/oclitellmac/providers/`: Provider/model cache
  - `~/.local/state/oclitellmac/key-info/`: Budget data (consumed by TUI plugin)

---

## Data Flow

### Startup Flow (Config Hook)

```
1. Load server.json
   ↓
2. For each enabled endpoint:
   a. Create LiteLLMClient
   b. Fetch /public/model_hub (required)
   c. Fetch /v1/model/info (optional, if apiKey provided)
   ↓
3. Transform pipeline:
   hubEntries + infoMap → transformModels()
   ├── categorizeModel() for each model
   ├── buildModelEntry() for each model
   └── returns { models, categories }
   ↓
4. Filter non-chat models:
   buildBlacklist(categories, enabledCategories)
   → blacklist: string[]
   ↓
5. Inject provider into opcodeConfig.provider[providerKey]:
   {
     npm: "@ai-sdk/openai-compatible",
     name: providerName,
     key: apiKey,
     options: { baseURL, apiKey, litellmProxy: true },
     blacklist: [...],
     models: { ... }
   }
   ↓
6. Cache to ~/.local/state/oclitellmac/providers/
   ↓
7. Start budget tracking (poll every 60s)
```

### Fallback Flow (Network Failure)

```
1. Fetch fails (timeout, connection error, etc.)
   ↓
2. If fallbackToCache enabled:
   a. Load from ~/.local/state/oclitellmac/providers/<providerKey>.json
   b. Restore models and categories from cache
   c. Log warning with cache timestamp
   d. Continue with cached data
   ↓
3. If fallbackToCache disabled or no cache:
   Skip this provider (log error)
```

### Budget Tracking Flow

```
1. Periodic Timer (every 60s):
   fetchAndStore(providerKey, client)
   ↓
2. Chat Message Hook:
   After each message, trigger immediate refresh
   ↓
3. Fetch /key/info:
   GET {baseUrl}/key/info
   Authorization: Bearer {apiKey}
   ↓
4. Store to ~/.local/state/oclitellmac/key-info/<providerKey>.json:
   {
     providerKey,
     fetchedAt,
     keyInfo: { spend, max_budget, ... }
   }
   ↓
5. TUI plugin reads this file and displays budget in sidebar
```

---

## Category Filtering Logic

### Detection (categorize.ts)

```typescript
function categorizeModel(name: string, mode: string): Category {
  // 1. Check API mode field (most reliable)
  if (mode === "embedding") return "embedding"
  if (mode === "audio_speech") return "audio_speech"
  // ... other mode mappings
  
  // 2. Fallback to name heuristics
  if (name.includes("embedding")) return "embedding"
  if (name.includes("tts")) return "audio_speech"
  // ... other name patterns
  
  // 3. Default to chat
  return "chat"
}
```

### Filtering (filter.ts)

```typescript
function buildBlacklist(
  categories: Map<string, Category>,
  enabledCategories: Set<Category>
): Array<[string, Category]> {
  const result = []
  for (const [modelId, category] of categories) {
    if (NON_CHAT_CATEGORIES.has(category) && !enabledCategories.has(category)) {
      result.push([modelId, category])
    }
  }
  return result.sort() // Stable ordering
}
```

### Configuration (index.ts)

```typescript
const enabledCategories = new Set<Category>()

if (endpoint.enableAllCategories) {
  // Enable all non-chat categories
  enabledCategories.add("embedding")
  enabledCategories.add("audio_speech")
  // ... etc.
} else if (endpoint.enabledCategories) {
  // Enable specific categories from config
  endpoint.enabledCategories.forEach(cat => enabledCategories.add(cat))
}
// else: empty set = chat only (default)

const blacklist = buildBlacklist(categories, enabledCategories)
```

---

## Field Mapping Priority

### Cost Fields

1. `/v1/model/info` (requires Bearer token, most detailed)
2. `/public/model_hub` (fallback, no auth required)

Example:
```typescript
const inputCost = getFirst(
  [info, "input_cost_per_token"],      // Preferred
  [hub, "input_cost_per_token"]        // Fallback
)
```

### Cache Costs

Only available from `/v1/model/info`:
- `cache_read_input_token_cost` → `cost.cache_read`
- `cache_creation_input_token_cost` → `cost.cache_write`

### Extended Context Costs

LiteLLM uses different field names:
- `/v1/model/info`: `*_above_128k_tokens`
- `/public/model_hub`: `*_above_200k_tokens`

Both map to OpenCode's `cost.context_over_200k` structure.

---

## Provider Injection

The plugin injects this structure into `config.provider[providerKey]`:

```typescript
{
  npm: "@ai-sdk/openai-compatible",      // AI SDK adapter
  name: "My LiteLLM Gateway",            // Display name
  key: "sk-...",                         // For TUI compatibility
  options: {
    baseURL: "https://gateway.com/v1",   // API endpoint
    apiKey: "sk-...",                    // Bearer token
    litellmProxy: true                   // Enable _noop tool injection
  },
  blacklist: [                           // Hide non-chat models
    "text-embedding-ada-002",
    "dall-e-3"
  ],
  models: {                              // Model configurations
    "gpt-4": { id, name, tool_call, cost, limit, ... },
    "claude-3-opus": { ... }
  }
}
```

### Why `litellmProxy: true`?

Enables automatic `_noop` tool injection when:
- Message history contains tool calls
- No active tools for current request
- Satisfies LiteLLM/Anthropic validation requirements

See: OpenCode PR #8658, `packages/opencode/src/session/llm.ts` L152-162

---

## Comparison with Python Tool

| Aspect | oclitellmac/server (TypeScript) | config-generator (Python) |
|--------|--------------------------------|---------------------------|
| **Purpose** | Runtime plugin, multi-endpoint | Static config generator, single endpoint |
| **Configuration** | `~/.config/oclitellmac/server.json` | CLI flags |
| **Output** | Injects into OpenCode config at runtime | Writes `opencode.jsonc` file |
| **Endpoints** | Multiple per plugin | One per invocation |
| **Caching** | Automatic with fallback | None |
| **Budget Tracking** | Continuous (60s polling + per-message) | None |
| **Restart Required** | Yes (for config changes) | No (manual re-run) |
| **Module Structure** | TypeScript (`.ts` files) | Python (`.py` files) |
| **Shared Logic** | ✅ Identical pipeline, field mappings, category detection | ✅ Same |

Both implementations:
- Use the same modular pipeline architecture
- Produce identical model configurations
- Share category detection logic
- Use the same LiteLLM endpoints

---

## Performance Considerations

### Startup Time
- Each endpoint adds ~1-2s to OpenCode startup (network fetch)
- Parallel fetching (`Promise.all`) for `/public/model_hub` and `/v1/model/info`
- Cached fallback keeps startup fast when endpoints are down

### Memory Usage
- Provider cache: ~100-500KB per endpoint (depends on model count)
- Budget data: ~1-5KB per endpoint
- All data stored as JSON files (no in-memory DB)

### Budget Polling
- Default: 60s interval + per-message trigger
- Minimal overhead (~100ms HTTP request)
- Fire-and-forget (doesn't block chat responses)

---

## Error Handling

### Network Errors
- Timeout after 30s (configurable)
- Falls back to cached data if `fallbackToCache: true`
- Logs detailed error messages with `input.client.app.log()`

### Configuration Errors
- Zod validation catches schema violations
- Returns empty hooks object (plugin fails gracefully)
- User sees error in OpenCode logs

### State File Errors
- File locking prevents concurrent write collisions
- Read errors fall back to empty data (logged)
- Write errors logged but don't block execution

---

## Future Enhancements

### Potential Improvements
1. **Hot Reload**: Watch `server.json` for changes, reload without restart
2. **Per-Model Overrides**: Allow config-level model customization
3. **Webhook Support**: Push notifications for budget alerts
4. **Health Checks**: Periodic endpoint health monitoring
5. **Multi-Provider Load Balancing**: Automatic failover between endpoints

### Compatibility
- OpenCode v1 plugin API (stable)
- LiteLLM proxy v1.x (tested with v1.40+)
- Node.js 18+ (fs.promises, AbortController)

---

*Last updated: May 2026*  
*Verified against: `plugins/oclitellmac/server/src/` (restructured modular architecture)*
