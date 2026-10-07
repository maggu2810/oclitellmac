# Server Plugin Architecture

**Plugin Type**: Server (OpenCode v2 plugin API, `@opencode/plugin`)  
**Entry Point**: `oclitellmac/server`  
**Pattern**: Provider transform registered during plugin setup  
**Source**: Adapted from `tools/config-generator` Python tool

---

## Overview

The server plugin (`oclitellmac/server`) automatically registers multiple LiteLLM proxy endpoints as OpenCode providers without requiring manual `opencode.json` editing. It uses a modular pipeline architecture shared with the `config-generator` Python tool.

### Key Design Decisions

1. **External Configuration**: Uses `~/.config/oclitellmac/server.json` (not `opencode.json`) for endpoint management
2. **Setup-Time Registration**: `setup(ctx)` fetches every endpoint first, then registers the results once with `ctx.provider.transform`. The transform callback is synchronous, so all network I/O happens before it
3. **Modular Pipeline**: Fetch → Categorize → Map → Build → Convert (`toV2`)
4. **Smart Caching**: Falls back to cached provider data when endpoints are unreachable
5. **Budget Tracking**: Continuous polling plus a refresh on each prompt via the `prompt` session hook
6. **Category Filtering**: Non-chat models are registered with `enabled: false` by default (configurable per endpoint)
7. **Two Routes, One Provider**: Claude models use the Anthropic-native Messages route; all other models use the OpenAI-compatible route. Both live under the same provider, credentials and base URL

---

## Module Structure

```
plugins/oclitellmac/server/src/
├── index.ts           # Plugin entry: setup, provider registration, hooks
├── paths.ts           # Path management (xdg-basedir wrapper)
├── config.ts          # Zod schemas, config loading
├── fetch.ts           # HTTP client for LiteLLM endpoints
├── categorize.ts      # Model category detection
├── map.ts             # Field mapping (LiteLLM → model fields)
├── build.ts           # Model entry builder
├── filter.ts          # Disabled-model selection for non-chat categories
├── transform.ts       # Pipeline orchestration
├── match.ts           # Model ID glob matching (`anthropicModels`)
├── toV2.ts            # Model entry → V2 `Model.Info`, per route
├── diagnostics.ts     # Request summaries for prompt-cache debugging
├── budget.ts          # Budget polling and tracking
└── state.ts           # File-based state management with locking
```

For the functions and behavior of each module, when working on a specific module, [read here](README.md).

---

## Data Flow

### Startup Flow (Plugin Setup)

```
1. Load ~/.config/oclitellmac/server.json
   (missing or invalid → log the reason, register nothing)
   ↓
2. For each enabled endpoint:
   a. Create LiteLLMClient
   b. Fetch /public/model_hub and /v1/model/info in parallel
   ↓
3. Transform pipeline:
   hubEntries + infoMap → transformModels()
   ├── categorizeModel() for each model
   ├── buildModelEntry() for each model
   └── returns { models, categories }
   ↓
4. Cache to ~/.local/state/oclitellmac/providers/
   ↓
5. Select models to disable:
   buildBlacklist(categories, enabledCategories)
   → non-chat models whose category is not enabled
   ↓
6. Convert to V2 definitions:
   one Provider.Info per endpoint
   one Model.Info per model via toModelInfo()
   (route chosen per model by `anthropicModels`)
   ↓
7. Register once:
   ctx.provider.transform(editor => editor.add({ info, models }))
   ↓
8. Start budget tracking (poll every 60s) and hooks
   ↓
9. Return a cleanup function that stops the budget timers
```

### Fallback Flow (Network Failure)

```
1. Fetch fails (timeout, connection error, etc.)
   ↓
2. If fallbackToCache enabled:
   a. Load from ~/.local/state/oclitellmac/providers/<providerKey>.json
   b. Restore models and categories from cache
   c. Log a notice with the cache timestamp
   d. Continue with cached data
   ↓
3. If fallbackToCache disabled or no cache:
   Skip this provider (log error)
```

Cached model entries written by an older plugin version may lack newer fields. They still convert, and the missing data (for example Anthropic reasoning variants) is filled in on the next successful fetch.

### Budget Tracking Flow

```
1. Periodic timer (every 60s):
   fetchAndStore(providerKey, providerName, client)
   ↓
2. Prompt hook (ctx.session.hook("prompt")):
   trigger an immediate refresh for every endpoint
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
     keyInfo: { spend, max_budget, ... }
   }
   ↓
5. TUI plugin reads this file and displays budget in sidebar
```

---

## Registered Definitions

For each endpoint the plugin registers one provider and its models.

### Provider

```typescript
{
  id: "my-litellm",                                   // providerKey
  name: "My LiteLLM Gateway",                         // display name
  activation: "enabled",
  package: "@opencode/ai/providers/openai-compatible",
  settings: {
    baseURL: "https://gateway.com/v1",                // baseUrl with a single /v1
    apiKey: "sk-...",
    // From endpoint.providerOptions (setCacheKey is applied per model instead):
    // timeout, chunkTimeout, headerTimeout (milliseconds)
  }
}
```

### Model

```typescript
{
  id: "claude-sonnet-5", modelID: "claude-sonnet-5", providerID: "my-litellm",
  name: "claude-sonnet-5",
  package: "@opencode/ai/providers/anthropic",   // Claude models only
  capabilities: { tools, input: [...], output: [...] },
  cost: [{ input, output, cache: { read, write } }],        // USD per million tokens
  limit: { context, input, output },
  variants: [...],
  enabled: true                                             // false for disabled categories
}
```

### Routes

| Route | Models | Package | Reasoning variants |
|-------|--------|---------|--------------------|
| OpenAI-compatible | Everything else | provider default | `reasoningEffort` per level LiteLLM reports |
| Anthropic-native | Models matching `anthropicModels` (default `claude-*`) | set on the model | Built from LiteLLM's thinking flags |

Of the two routes, only the Anthropic-native one gets prompt-cache breakpoints (`cache_control`) from OpenCode; the OpenAI-compatible chat route sends none. That is why Claude models use their own route. The gateway must expose `POST <baseUrl>/v1/messages` for this to work. For the configuration field, when configuring which models use the Anthropic route, [read here](../docs/CONFIGURATION.md#anthropicmodels-optional).

Anthropic variants follow what LiteLLM reports in `/v1/model/info`:

- `supports_adaptive_thinking` → adaptive thinking with effort levels. LiteLLM only flags the levels beyond the base ones, so `low`, `medium` and `high` are implied, and `xhigh` and `max` are added when `supports_xhigh_reasoning_effort` and `supports_max_reasoning_effort` are set.
- Reasoning without the adaptive flag → token-budget variants (`high`, `max`) sized from the model's output limit.
- No reasoning flags → no variants.

### LiteLLM Compatibility: No `litellmProxy` Workaround

Earlier plugin versions set a `litellmProxy` option to work around an Anthropic tool-call validation error in some LiteLLM versions. OpenCode no longer needs it: the OpenAI chat route sends an empty `tools` array when the history contains tool calls and no tools are active, and the validation issue was fixed in LiteLLM itself.

**Requirement**: run **LiteLLM ≥ v1.85.0-rc.2** for correct tool-call-history behavior with Anthropic models. For background, when checking the origin of this requirement, [read here](../../../docs/litellm-integration/field-coverage-comparison.md).

---

## Comparison with Python Tool

| Aspect | oclitellmac/server (TypeScript) | config-generator (Python) |
|--------|--------------------------------|---------------------------|
| **Purpose** | Runtime plugin, multi-endpoint | Static config generator, single endpoint |
| **Configuration** | `~/.config/oclitellmac/server.json` | CLI flags |
| **Output** | Registers providers at runtime through the plugin API | Writes `opencode.jsonc` file |
| **Endpoints** | Multiple per plugin | One per invocation |
| **Caching** | Automatic with fallback | None |
| **Budget Tracking** | Continuous (60s polling + per-prompt) | None |
| **Restart Required** | Yes (for config changes) | No (manual re-run) |
| **Module Structure** | TypeScript (`.ts` files) | Python (`.py` files) |
| **Shared Logic** | ✅ Same pipeline, field mappings, category detection | ✅ Same |

Both implementations:
- Use the same modular pipeline architecture
- Share category detection logic
- Use the same LiteLLM endpoints

They differ in output: the plugin targets the V2 model format, the Python tool the `opencode.jsonc` format.

---

## Future Enhancements

1. **Hot Reload**: Watch `server.json` for changes and call `ctx.provider.reload()` without a restart
2. **Per-Model Overrides**: Allow config-level model customization, such as variant overrides
3. **Webhook Support**: Push notifications for budget alerts
4. **Health Checks**: Periodic endpoint health monitoring
5. **Multi-Provider Load Balancing**: Automatic failover between endpoints

---

*Last updated: October 2026*  
*Verified against: `plugins/oclitellmac/server/src/` and the OpenCode version recorded in the [source map](../../../docs/litellm-integration/source-map.md)*
