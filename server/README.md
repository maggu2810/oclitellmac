# Server Plugin - Technical Reference

**Plugin Type**: Server (v1 plugin API)  
**Entry Point**: `oclitellmac/server`

## Overview

The server plugin automatically discovers and configures LiteLLM proxy endpoints as OpenCode providers. It uses a modular pipeline architecture to fetch, categorize, and inject model configurations at runtime.

### Key Responsibilities

1. Load configuration from `~/.config/oclitellmac/server.json`
2. Fetch models from LiteLLM endpoints (`/public/model_hub` and `/v1/model/info`)
3. Categorize models (chat, embedding, TTS, etc.)
4. Apply category-based filtering (blacklist non-chat models by default)
5. Inject providers into OpenCode config via `config` hook
6. Track budget data via `/key/info` polling
7. Write budget data to files for TUI consumption

### Architecture Pattern

**Config Hook Injection Pattern** (inspired by BlakeHastings plugin):
- Directly mutates `config.provider` object at runtime
- No user `opencode.json` editing required
- Clean, automatic provider registration

## Module Structure

```
plugins/oclitellmac/server/src/
├── index.ts           # Plugin entry, config/chat.message hooks
├── paths.ts           # Path management (xdg-basedir wrapper)
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

#### `paths.ts` - Path Management
- Centralized path management using `xdg-basedir` library
- Exports base directories and specific subdirectory functions
- XDG-compliant on Linux (respects `XDG_CONFIG_HOME`, `XDG_STATE_HOME`)
- Uses Unix-style paths on all platforms (consistent with OpenCode core)

**Exported Functions**:
- `getConfigPath()`: Returns `~/.config/oclitellmac/server.json`
- `getProviderCacheDir()`: Returns `~/.local/state/oclitellmac/providers`
- `getBudgetDataDir()`: Returns `~/.local/state/oclitellmac/key-info`
- `getConfigDir()`, `getStateDir()`: Base directory getters with validation

**Platform Behavior**:
- Linux: Respects `XDG_*` environment variables (default: `~/.config`, `~/.local/state`)
- macOS/Windows: Uses Unix-style paths (`~/.config`, `~/.local/state`)

See `../PATH-STRATEGY.md` for detailed rationale and alternative approaches considered.

#### `index.ts` - Plugin Orchestration
- Loads configuration from `~/.config/oclitellmac/server.json`
- Implements `config` hook (injects providers into `opcodeConfig.provider`)
- Implements `chat.message` hook (triggers budget refresh after each message)
- Manages provider injection with caching fallback
- Coordinates budget tracking lifecycle

**Key Functions**:
- `config()`: Main entry point, orchestrates provider injection
- `injectProvider()`: Fetches models, builds provider config, injects into OpenCode
- Hook registration returns `{ config, "chat.message" }` object

#### `config.ts` - Configuration Schema
- Defines Zod schemas for validation:
  - `EndpointConfigSchema`: Per-endpoint settings (baseUrl, apiKey, categories, etc.)
  - `ServerConfigSchema`: Global options (timeout, polling interval, caching)
- Loads and validates `server.json`
- Provides typed config interfaces

**Key Functions**:
- `loadConfig()`: Reads and parses `~/.config/oclitellmac/server.json`
- Schema validation with detailed error messages

#### `fetch.ts` - HTTP Client
- `LiteLLMClient` class with three methods:
  - `fetchModelHub()`: GET `/public/model_hub` (no auth)
  - `fetchModelInfo()`: GET `/v1/model/info` (requires Bearer token)
  - `fetchKeyInfo()`: GET `/key/info` (budget data)
- Timeout handling with AbortController
- Error handling with detailed logging

**Key Features**:
- Configurable timeout (default: 30s)
- Proper Bearer token authentication
- Clear error messages for debugging

#### `categorize.ts` - Model Classification
- `categorizeModel(name, mode)`: Determines model category
  - Priority: API `mode` field → name heuristics → "chat" fallback
- `NON_CHAT_CATEGORIES`: Set of non-chat categories for filtering
- `CATEGORY_LABEL`: Human-readable category descriptions

**Categories**:
- `chat` (default)
- `embedding` (text embeddings)
- `audio_speech` (TTS)
- `transcription` (STT)
- `image_generation`, `video_generation`
- `ocr`, `ranking`, `router`

#### `map.ts` - Field Mapping
Maps LiteLLM API fields to OpenCode `ModelConfig` structure:

- `mapFlags(hub, info)`: Capability flags (tool_call, attachment, reasoning, temperature)
- `mapModalities(hub, info)`: Input/output modality arrays
- `mapCost(hub, info)`: Cost fields (input, output, cache_read, cache_write, context_over_200k)
- `mapLimit(hub, info)`: Token limits (context, input, output)

**Priority**: Uses `getFirst()` helper to prefer `/v1/model/info` over `/public/model_hub`

#### `build.ts` - Model Entry Builder
- `buildModelEntry(hub, info, category)`: Constructs OpenCode `ModelConfig` object
- Omits false/empty fields to keep config minimal
- Always includes: `id`, `name`, `modalities`
- Conditionally includes: capability flags (when true), `cost` (when available), `limit` (when available)

#### `filter.ts` - Blacklist Generation
- `buildBlacklist(categories, enabledCategories)`: Returns array of model IDs to hide
- Filters models where:
  - Category is in `NON_CHAT_CATEGORIES`
  - Category is NOT in `enabledCategories`
- Stable ordering (by category, then by model ID) for readable output

#### `transform.ts` - Pipeline Orchestration
- `transformModels(hubEntries, infoMap)`: Main pipeline function
- Returns: `{ models: Record<string, any>, categories: Map<string, Category> }`
- Iterates over hub entries, categorizes each model, builds model config

**Pipeline Flow**:
```
hubEntries + infoMap
  → categorize each model
  → map LiteLLM fields to OpenCode fields
  → build model entry
  → return { models, categories }
```

#### `budget.ts` - Budget Tracking
- `BudgetTracker` class:
  - `startTracking(providerKey, providerName, client)`: Initiates periodic polling
  - `fetchAndStore(providerKey, providerName, client)`: One-time budget fetch
  - `stopTracking(providerKey)`: Cleanup
- Stores budget data to `~/.local/state/oclitellmac/key-info/<providerKey>.json`
- Polling interval configurable via `budgetPollInterval` (default: 60s)
- Includes `providerName` in budget files for TUI display

**Budget File Format**:
```json
{
  "providerKey": "litellm-prod",
  "providerName": "LiteLLM Production",
  "fetchedAt": 1736647260000,
  "keyInfo": { /* LiteLLM /key/info response */ }
}
```

#### `state.ts` - State Management
- `StateManager` class:
  - `saveProviderCache(providerKey, data)`: Write provider/model data with file locking
  - `loadProviderCache(providerKey)`: Read cached provider data
  - `saveBudgetData(providerKey, data)`: Write budget data with file locking
  - `loadBudgetData(providerKey)`: Read cached budget data
  - `getProviderCacheDir()`, `getBudgetDataDir()`: Path getters (delegate to `paths.ts`)
- Uses `fs.promises` with exclusive locking to prevent write collisions
- Paths obtained via `paths.ts` module (XDG-compliant)

**Locking Strategy**: Promise serialization via `Map<key, Promise>` - no external lock files needed

## Data Flow

### Startup Flow (Config Hook)

```
1. Load ~/.config/oclitellmac/server.json
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
   fetchAndStore(providerKey, providerName, client)
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
     providerName,
     fetchedAt,
     keyInfo: { /* full /key/info response */ }
   }
   ↓
5. TUI plugin reads this file and displays budget in sidebar
```

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
): string[] {
  const result = []
  for (const [modelId, category] of categories) {
    if (NON_CHAT_CATEGORIES.has(category) && !enabledCategories.has(category)) {
      result.push(modelId)
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

### LiteLLM Compatibility: The `litellmProxy` Option

**What it does**: Enables automatic `_noop` tool injection for LiteLLM proxy compatibility.

**Why it's needed**: When using Anthropic models (Claude) through LiteLLM, requests with tool call history but no active tools will fail with:
```
Anthropic doesn't support tool calling without tools= param specified
```

This occurs when previous messages contained tool calls (e.g., `bash`, `read`, `edit`) but the current request doesn't need any tools.

**How oclitellmac handles it**: The plugin automatically sets `options.litellmProxy: true` in all provider configurations, which tells OpenCode to inject a dummy `_noop` tool when:
- Message history contains tool calls (`tool-call` or `tool-result` content parts)
- Current request has no active tools defined

**The `_noop` tool**:
- Satisfies LiteLLM's validation requirement
- Never actually called (empty schema, generic description)
- Automatically filtered from UI (`activeTools` list)
- Zero functional impact (pure validation workaround)

**When it activates**:
- Automatically detected if provider ID contains "litellm"
- Or explicitly set via `options.litellmProxy: true` (what oclitellmac does)

**Configuration**:
oclitellmac sets this automatically for all endpoints. No user configuration needed.

**Reference**: 
- OpenCode PR [#8658](https://github.com/anomalyco/opencode/pull/8658) - Added explicit `litellmProxy` option
- OpenCode issues [#8246](https://github.com/anomalyco/opencode/issues/8246), [#2915](https://github.com/anomalyco/opencode/issues/2915)
- Implementation: `packages/opencode/src/session/llm.ts` (lines 142-162)

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

## Compatibility

- OpenCode v1 plugin API (stable)
- LiteLLM proxy v1.x (tested with v1.40+)
- Node.js 18+ (fs.promises, AbortController)

## Related Documentation

- **Architecture Deep Dive**: See `ARCHITECTURE.md` for detailed pipeline documentation
- **Implementation Details**: See `IMPLEMENTATION.md` for creation story and design decisions
- **Testing Guide**: See `VERIFICATION.md` for comprehensive testing checklist
- **User Guide**: See `../README.md` for installation and configuration
