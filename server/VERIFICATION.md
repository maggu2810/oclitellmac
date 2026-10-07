# Server Plugin - Verification Checklist

## ✅ Files Created

- [x] `package.json` - Package configuration with dependencies
- [x] `tsconfig.json` - TypeScript configuration
- [x] `README.md` - Technical documentation (server plugin)
- [x] `ARCHITECTURE.md` - Pipeline stages and data flow
- [x] `IMPLEMENTATION.md` - Implementation details and summary
- [x] `VERIFICATION.md` - This checklist
- [x] `config-example.json` - Example configuration file
- [x] `.gitignore` - Git ignore rules
- [x] `src/index.ts` - Main plugin entry point (`setup`, provider registration, hooks)
- [x] `src/config.ts` - Zod configuration schema and loader
- [x] `src/paths.ts` - XDG-compliant config/state path resolution
- [x] `src/fetch.ts` - LiteLLM API client (`/public/model_hub`, `/v1/model/info`, `/key/info`)
- [x] `src/categorize.ts` - Model category detection (chat, embedding, TTS, etc.)
- [x] `src/map.ts` - Field mapping (LiteLLM → OpenCode `ModelConfig`)
- [x] `src/build.ts` - `ModelConfig` entry construction
- [x] `src/filter.ts` - Disabled-model selection for non-chat categories
- [x] `src/transform.ts` - Pipeline orchestration (fetch → categorize → map → build)
- [x] `src/state.ts` - State management with file locking
- [x] `src/budget.ts` - Budget tracking logic (polling + event-based)
- [x] `src/match.ts` - Model ID glob matching for `anthropicModels`
- [x] `src/toV2.ts` - Model entry → V2 `Model.Info`, per route
- [x] `src/diagnostics.ts` - Request summaries for prompt-cache debugging

**Total:** 14 source files, see [IMPLEMENTATION.md](IMPLEMENTATION.md) for
the full file structure.

## 🎯 Features Implemented

### Core Functionality
- [x] Load configuration from `~/.config/oclitellmac/server.json`
- [x] Support multiple LiteLLM endpoints
- [x] Fetch models from `/public/model_hub` (no auth)
- [x] Fetch detailed model info from `/v1/model/info` (with auth)
- [x] Build OpenCode-compatible model configs
- [x] Register providers via `ctx.provider.transform`
- [x] Route Claude models to the Anthropic-native route (`anthropicModels`)
- [x] Set API keys in provider settings (no auth.json needed)

### Caching & Fallback
- [x] Cache provider data to `~/.local/state/oclitellmac/providers/`
- [x] Fall back to cached data if endpoint unreachable
- [x] Log warnings when using cached data
- [x] Configurable `fallbackToCache` option

### Budget Tracking
- [x] Poll `/key/info` periodically (every 60s by default)
- [x] Fetch budget on each prompt
- [x] Store budget data to `~/.local/state/oclitellmac/key-info/`
- [x] File locking to prevent concurrent write collisions
- [x] Configurable `budgetPollInterval`

### Robustness
- [x] File locking via Promise serialization
- [x] Comprehensive error handling
- [x] Clear logging to `~/.local/state/oclitellmac/server.log`
- [x] Graceful degradation when endpoints fail
- [x] Enable/disable individual endpoints
- [x] Configurable timeouts

### Code Quality
- [x] TypeScript with strict mode
- [x] Type-safe configuration with `zod`
- [x] Modular pipeline architecture (11 source files), shared design with `tools/config-generator`
- [x] Clear function documentation
- [x] Consistent error messages

## 📋 Installation Steps

1. **Install dependencies:**
   ```bash
   cd /path/to/plugins/oclitellmac
   bun install
   ```

2. **Create configuration:**
   ```bash
   mkdir -p ~/.config/oclitellmac
   cp server/config-example.json ~/.config/oclitellmac/server.json
   # Edit with your LiteLLM endpoints
   ```

3. **Add to OpenCode:** when registering the plugin, [read here](../docs/INSTALL.md)

4. **Restart OpenCode**

## 🧪 Testing Checklist

### Pre-Test Setup
- [ ] `bun install` completed successfully
- [ ] Configuration file created at `~/.config/oclitellmac/server.json`
- [ ] At least one endpoint configured with valid URL and API key
- [ ] Plugin added to OpenCode

### Basic Functionality Tests
- [ ] OpenCode starts without errors
- [ ] `~/.local/state/oclitellmac/server.log` shows the fetch and registration lines (see Expected Log Output)
- [ ] Providers appear in OpenCode model picker
- [ ] Models are selectable
- [ ] Can send chat messages using LiteLLM models
- [ ] State directory created: `~/.local/state/oclitellmac/`
- [ ] Provider cache files created: `~/.local/state/oclitellmac/providers/<key>.json`
- [ ] Budget files created: `~/.local/state/oclitellmac/key-info/<key>.json`

### Caching & Fallback Tests
- [ ] Disable one endpoint temporarily (set `enabled: false`)
- [ ] Verify it doesn't appear in model picker
- [ ] Re-enable endpoint
- [ ] Simulate unreachable endpoint (wrong URL)
- [ ] Verify fallback to cached data works
- [ ] Check for "Using cached data" log message

### Budget Tracking Tests
- [ ] Send a prompt
- [ ] Check budget file is updated after the prompt
- [ ] Wait 60 seconds
- [ ] Check budget file is updated again
- [ ] Verify `fetchedAt` timestamp updates

### Cost & Variants Tests

- [ ] Pick a model with known LiteLLM pricing (e.g. `claude-sonnet-4-5` at
      `input_cost_per_token: 0.000003`, `output_cost_per_token: 0.000015`)
- [ ] Check the injected `models.<id>.cost` block shows **USD per million
      tokens** (`{"input": 3, "output": 15}`), not the raw per-token value
      (`{"input": 0.000003, "output": 0.000015}`) — see
      [docs/litellm-integration/field-coverage-comparison.md §2a](../../../docs/litellm-integration/field-coverage-comparison.md)
      for the conversion rationale
- [ ] Run a real chat completion and confirm `/cost` in OpenCode matches
      LiteLLM's own `x-litellm-response-cost` header (within rounding)
- [ ] Pick a model with `supports_<level>_reasoning_effort` flags in
      `/v1/model/info` and confirm `models.<id>.variants` lists each
      supported level as `{ id: "<level>", settings: { reasoningEffort: "<level>" } }`
      (OpenAI-compatible route)

### Anthropic Route Tests

- [ ] `server.log` shows `<providerKey>: N/M models use the Anthropic route` with
      N equal to the number of `claude-*` models
- [ ] A Claude model answers a prompt, including a tool call
- [ ] Adaptive Claude models list `low`, `medium` and `high`, plus `xhigh` and
      `max` where LiteLLM reports them; budget-only models list `high` and `max`
- [ ] Non-Claude models stay on the OpenAI-compatible route and still answer
- [ ] With `options.cachePrefixDiagnostics: true`, each primary request adds a
      JSON line with `cache_control_present: true`; across consecutive steps
      `stable_prefix_hash` stays unchanged and `first_divergence_index` is
      `null` or points at the conversation tail
- [ ] Directly against the gateway, two identical requests with a large stable
      prefix and `cache_control`: the second reports a large
      `cache_read_input_tokens`

### Error Handling Tests
- [ ] Invalid JSON in config file - check error message
- [ ] Missing config file - check graceful handling
- [ ] Invalid API key - check fallback behavior
- [ ] Unreachable endpoint with no cache - check skip behavior

## 📊 Expected Log Output

```
<timestamp> Fetching models for my-litellm from https://litellm.example.com...
<timestamp> Loaded 15 models for my-litellm
<timestamp> Started budget tracking for my-litellm (interval: 60s)
<timestamp> Provider injection complete: 1/1 endpoints
<timestamp> my-litellm: 4/15 models use the Anthropic route
<timestamp> Budget data updated for my-litellm
```

## 🚨 Common Issues & Solutions

### Issue: "Failed to load config"
**Solution:** Create `~/.config/oclitellmac/server.json` with valid JSON

### Issue: "No cached data available"
**Solution:** Ensure endpoint was successfully fetched at least once before

### Issue: Models not appearing
**Solution:** 
- Check endpoint URL is correct
- Verify API key is valid
- Check `~/.local/state/oclitellmac/server.log` for error messages

### Issue: Budget data not updating
**Solution:**
- Verify `/key/info` endpoint works: `curl -H "Authorization: Bearer sk-..." https://your-proxy/key/info`
- Check file permissions on `~/.local/state/oclitellmac/`

## ✨ Success Criteria

The plugin is working correctly if:
1. ✅ OpenCode starts without errors
2. ✅ All enabled LiteLLM endpoints appear as providers
3. ✅ Models are selectable in the model picker
4. ✅ Chat messages work with LiteLLM models
5. ✅ State directory and files are created
6. ✅ Budget data updates periodically and after prompts
7. ✅ Fallback to cache works when endpoint is unreachable
8. ✅ Claude models use the Anthropic route and non-Claude models the OpenAI-compatible route
9. ✅ Clear log messages in `~/.local/state/oclitellmac/server.log`

## 🎉 Next Steps

Once verified working:
1. **TUI plugin** (`oclitellmac/tui`) is already included - verify budget display in sidebar
2. **Add configuration hot-reload** (watch `server.json` for changes)
3. **Implement retry logic** with exponential backoff
4. **Add health checks** for endpoint availability monitoring

---

**Status:** ✅ Implementation Complete - Ready for Testing!
