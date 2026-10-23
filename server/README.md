# Server Plugin - Technical Reference

**Plugin Type**: Server (OpenCode v2 plugin API)  
**Entry Point**: `oclitellmac/server`

## Overview

The server plugin automatically discovers LiteLLM proxy endpoints and registers them as OpenCode providers. It uses a modular pipeline to fetch, categorize and convert model definitions at startup.

When looking for the overall design, data flows or the registered provider and model shape, [read here](ARCHITECTURE.md).

### Key Responsibilities

1. Load configuration from `~/.config/oclitellmac/server.json`
2. Fetch models from LiteLLM endpoints (`/public/model_hub` and `/v1/model/info`)
3. Categorize models (chat, embedding, TTS, etc.)
4. Disable non-chat models by default (per-endpoint category opt-in)
5. Route each model to the OpenAI-compatible or the Anthropic-native route
6. Register providers and models through `ctx.provider.transform`
7. Track budget data via `/key/info` polling
8. Write budget data to files for TUI consumption

## Module Structure

```
plugins/oclitellmac/server/src/
├── index.ts           # Plugin entry: setup, provider registration, hooks
├── paths.ts           # Path management (xdg-basedir wrapper)
├── config.ts          # Zod schemas, config loading
├── fetch.ts           # HTTP client for LiteLLM endpoints
├── categorize.ts      # Model category detection (chat/embedding/TTS/etc.)
├── map.ts             # Field mapping (LiteLLM → model fields)
├── build.ts           # Model entry builder
├── filter.ts          # Disabled-model selection for non-chat categories
├── transform.ts       # Pipeline orchestration
├── match.ts           # Model ID glob matching
├── toV2.ts            # Model entry → V2 Model.Info, per route
├── diagnostics.ts     # Request summaries for prompt-cache debugging
├── log.ts             # RotatingLog for server.log
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

When looking for the rationale and alternatives considered, [read here](../docs/PATH-STRATEGY.md).

#### `index.ts` - Plugin Orchestration
- Default export is `{ id: "oclitellmac.server", setup(ctx) }`
- `setup` loads the configuration, fetches every enabled endpoint (with cache fallback), converts the results and registers them once with `ctx.provider.transform`
- Registers a `model.request` session hook that refreshes the budget of the provider being used
- Registers the optional `http.request` diagnostics hook when `cachePrefixDiagnostics` is on
- Returns a cleanup function that stops budget polling
- Logs to `~/.local/state/oclitellmac/server.log` through `RotatingLog`, which moves the file to `server.log.1` above 2 MiB (the plugin context has no logging API)

#### `config.ts` - Configuration Schema
- Defines Zod schemas for validation:
  - `EndpointConfigSchema`: Per-endpoint settings (baseUrl, apiKey, categories, `anthropicModels`, `cacheBreakpointModels`, `providerOptions`)
  - `ServerConfigSchema`: Global options (timeout, polling interval, caching, diagnostics)
- Loads and validates `server.json`
- Provides typed config interfaces

For the field reference, when changing or adding configuration fields, [read here](../docs/CONFIGURATION.md).

**Key Functions**:
- `loadConfig()`: Reads and parses `~/.config/oclitellmac/server.json`
- Schema validation with detailed error messages

#### `fetch.ts` - HTTP Client
- `LiteLLMClient` class with three methods:
  - `fetchModelHub()`: GET `/public/model_hub` (no auth)
  - `fetchModelInfo()`: GET `/v1/model/info` (requires Bearer token)
  - `fetchKeyInfo()`: GET `/key/info` (budget data)
- Timeout handling with AbortController
- Derives `supports_reasoning_efforts` from the `supports_<level>_reasoning_effort` flags

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
Maps LiteLLM API fields to the model entry structure:

- `mapFlags(hub, info)`: Capability flags (tool_call, attachment, reasoning, temperature)
- `mapModalities(hub, info)`: Input/output modality arrays
- `mapCost(hub, info)`: Cost fields (input, output, cache_read, cache_write, context_over_200k)
- `mapLimit(hub, info)`: Token limits (context, input, output)
- `mapVariants(info)`: Reasoning-effort variants for the OpenAI-compatible route
- `mapThinking(hub, info)`: Thinking capabilities for the Anthropic route (`adaptive` with effort levels, or `budget`)

**Priority**: Uses `getFirst()` helper to prefer `/v1/model/info` over `/public/model_hub`

#### `build.ts` - Model Entry Builder
- `buildModelEntry(hub, info, category)`: Constructs the model entry
- Omits false/empty fields to keep the entry minimal
- Always includes: `id`, `name`, `modalities`
- Conditionally includes: capability flags (when true), `cost`, `limit`, `variants` and `thinking` (when available)

#### `filter.ts` - Disabled-Model Selection
- `buildBlacklist(categories, enabledCategories)`: Returns `[modelId, category]` pairs for models to disable
- Selects models where:
  - Category is in `NON_CHAT_CATEGORIES`
  - Category is NOT in `enabledCategories`
- Stable ordering (by category, then by model ID)
- `index.ts` registers the selected models with `enabled: false`; V2 has no provider blacklist

#### `transform.ts` - Pipeline Orchestration
- `transformModels(hubEntries, infoMap)`: Main pipeline function
- Returns: `{ models: Record<string, any>, categories: Map<string, Category> }`
- Iterates over hub entries, categorizes each model, builds the model entry

**Pipeline Flow**:
```
hubEntries + infoMap
  → categorize each model
  → map LiteLLM fields
  → build model entry
  → return { models, categories }
```

#### `match.ts` - Model ID Matching
- `matchesAny(id, patterns)`: Case-insensitive glob match where `*` is the only wildcard
- Used with `anthropicModels` to choose each model's route, and with `cacheBreakpointModels` to mark OpenAI-compatible models for cache breakpoints

#### `toV2.ts` - V2 Conversion
- `toModelInfo(providerKey, entry, options)`: Converts a model entry to a V2 `Model.Info`
- Options: `enabled`, `anthropic` (route), `providerSetsCacheKey` (the provider sets `supportsPromptCacheKey`; Anthropic-route models turn it off), `cacheBreakpoints` (OpenAI-compatible route only: `compatibility.cacheFormat: "anthropic"`)
- Anthropic route: sets the `package` on the model and builds variants from `entry.thinking`
- OpenAI-compatible route: variants use `reasoningEffort`
- Costs, limits and capabilities are identical on both routes

#### `log.ts` - Rotating Log
- `RotatingLog(file, maxBytes)`: appends lines, serialized, and moves the file to `<file>.1` once it exceeds `maxBytes` (2 MiB for `server.log`); IO errors are swallowed

#### `diagnostics.ts` - Cache Diagnostics
- `summarizeRequest(body)`: Counts and hashes only (breakpoints, system and tool counts, tool-schema hash, stable-prefix hash, options hash). Never content
- `firstDivergence(previous, current)`: Index of the first block that changed since the previous request
- Enabled by `options.cachePrefixDiagnostics`

#### `budget.ts` - Budget Tracking
- `BudgetTracker` class:
  - `startTracking(providerKey, providerName, client)`: Fetches once, then adds the provider to the single polling timer
  - `fetchAndStore(providerKey, providerName, client)`: One-time budget fetch
  - `refreshForRequest(providerKey)`: Marks the provider as in use and refreshes it unless it was fetched within the last 10 seconds
  - `stopTracking(providerKey)`: Cleanup for one provider
  - `stopAll()`: Cleanup for all providers (called from the setup cleanup)
- `pickBudgetFields(keyInfo)`: Projection of `/key/info` onto the fields the TUI reads
- Stores budget data to `~/.local/state/oclitellmac/key-info/<providerKey>.json`
- Polling interval configurable via `budgetPollInterval` (default: 60s); providers not used in the last 30 minutes are polled every 10th interval
- Includes `providerName` in budget files for TUI display

**Budget File Format**:
```json
{
  "providerKey": "litellm-prod",
  "providerName": "LiteLLM Production",
  "fetchedAt": 1736647260000,
  "keyInfo": {
    "info": { "key_alias": "...", "spend": 1.23, "max_budget": 10, "budget_duration": "30d", "budget_reset_at": "...", "expires": null }
  }
}
```

Only the fields above are stored; the rest of the `/key/info` response, including the key itself, is dropped.

#### `state.ts` - State Management
- `StateManager` class:
  - `saveProviderCache(providerKey, data)`: Write provider/model data with file locking
  - `loadProviderCache(providerKey)`: Read cached provider data
  - `saveBudgetData(providerKey, data)`: Write budget data with file locking
  - `loadBudgetData(providerKey)`: Read cached budget data
  - `getProviderCacheDir()`, `getBudgetDataDir()`: Path getters (delegate to `paths.ts`)
- Uses `fs.promises` with exclusive locking to prevent write collisions
- Files are written atomically (temp file, then rename) with mode 0600, in directories created with mode 0700
- Paths obtained via `paths.ts` module (XDG-compliant); the constructor accepts directories for tests

**Locking Strategy**: Promise serialization via `Map<key, Promise>` - no external lock files needed

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
  // Non-chat models whose category is not enabled,
  // grouped by category and sorted by model ID
}
```

### Configuration (index.ts)

```typescript
const enabledCategories = new Set<Category>(
  endpoint.enableAllCategories ? ALL_NON_CHAT : endpoint.enabledCategories ?? [],
)
const disabled = new Set(buildBlacklist(categories, enabledCategories).map(([id]) => id))
// A model is registered with `enabled: !disabled.has(id)`
```

An empty set means chat only (default).

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

LiteLLM reports cost per single token; the plugin converts to USD per million tokens, which is what OpenCode expects.

### Cache Costs

Only available from `/v1/model/info`:
- `cache_read_input_token_cost` → `cost.cache_read`
- `cache_creation_input_token_cost` → `cost.cache_write`

### Extended Context Costs

LiteLLM uses different field names:
- `/v1/model/info`: `*_above_128k_tokens`
- `/public/model_hub`: `*_above_200k_tokens`

Both map to a second cost tier at 200,000 context tokens.

## Performance Considerations

### Startup Time
- Each endpoint adds ~1-2s to OpenCode startup (network fetch)
- Endpoints are fetched concurrently; `/public/model_hub` is fetched once per base URL and `/v1/model/info` once per endpoint
- Cached fallback keeps startup fast when endpoints are down
- No model is ever prompted at startup; only GET requests are made

### Memory Usage
- Provider cache: ~100-500KB per endpoint (depends on model count)
- Budget data: ~1-5KB per endpoint
- All data stored as JSON files (no in-memory DB)

### Budget Polling
- Default: 60s interval for the provider in use, every 10th interval for the others, plus a refresh of the provider used by each primary request (at most once per 10 seconds)
- Minimal overhead (~100ms HTTP request)
- Fire-and-forget (doesn't block chat responses)

## Error Handling

### Network Errors
- Timeout after 30s (configurable)
- Falls back to cached data if `fallbackToCache: true`
- Logs detailed error messages to `server.log`

### Configuration Errors
- Zod validation catches schema violations
- The plugin logs the reason and registers nothing (fails gracefully)
- The reason is in `~/.local/state/oclitellmac/server.log`

### State File Errors
- File locking prevents concurrent write collisions
- Read errors fall back to empty data (logged)
- Write errors logged but don't block execution

## Testing

Unit tests live in `server/test/` and run with `bun test` from the plugin directory. They cover config validation, route matching, the V2 conversion for both routes, thinking-capability mapping and the diagnostics summaries. When running live checks against a gateway, [read here](VERIFICATION.md).

## Compatibility

- OpenCode v2 plugin API (`@opencode/plugin`); the verified OpenCode version is recorded in the [source map](../../../docs/litellm-integration/source-map.md)
- LiteLLM proxy with `/v1/model/info`; the Anthropic route also needs `POST /v1/messages`
- Node.js 18+ (fs.promises, AbortController)

## Related Documentation

- **Architecture Deep Dive**: When looking for design decisions, data flows or the registered provider shape, [read here](ARCHITECTURE.md)
- **Implementation Details**: When looking for the creation story and design history, [read here](IMPLEMENTATION.md)
- **Testing Guide**: When verifying the plugin end to end, [read here](VERIFICATION.md)
- **User Guide**: When looking for installation and configuration, [read here](../README.md)
