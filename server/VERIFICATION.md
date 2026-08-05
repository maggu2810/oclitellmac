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
- [x] `src/index.ts` - Main plugin entry point (`config` + `chat.message` hooks)
- [x] `src/config.ts` - Zod configuration schema and loader
- [x] `src/paths.ts` - XDG-compliant config/state path resolution
- [x] `src/fetch.ts` - LiteLLM API client (`/public/model_hub`, `/v1/model/info`, `/key/info`)
- [x] `src/categorize.ts` - Model category detection (chat, embedding, TTS, etc.)
- [x] `src/map.ts` - Field mapping (LiteLLM → OpenCode `ModelConfig`)
- [x] `src/build.ts` - `ModelConfig` entry construction
- [x] `src/filter.ts` - Blacklist generation for non-chat models
- [x] `src/transform.ts` - Pipeline orchestration (fetch → categorize → map → build)
- [x] `src/state.ts` - State management with file locking
- [x] `src/budget.ts` - Budget tracking logic (polling + event-based)

**Total:** 11 source files, see [IMPLEMENTATION.md](IMPLEMENTATION.md) for
the full file structure.

## 🎯 Features Implemented

### Core Functionality
- [x] Load configuration from `~/.config/oclitellmac/server.json`
- [x] Support multiple LiteLLM endpoints
- [x] Fetch models from `/public/model_hub` (no auth)
- [x] Fetch detailed model info from `/v1/model/info` (with auth)
- [x] Build OpenCode-compatible model configs
- [x] Inject providers via `config` hook
- [x] Embed API keys in provider options (no auth.json needed)

### Caching & Fallback
- [x] Cache provider data to `~/.local/state/oclitellmac/providers/`
- [x] Fall back to cached data if endpoint unreachable
- [x] Log warnings when using cached data
- [x] Configurable `fallbackToCache` option

### Budget Tracking
- [x] Poll `/key/info` periodically (every 60s by default)
- [x] Fetch budget after each chat message
- [x] Store budget data to `~/.local/state/oclitellmac/key-info/`
- [x] File locking to prevent concurrent write collisions
- [x] Configurable `budgetPollInterval`

### Robustness
- [x] File locking via Promise serialization
- [x] Comprehensive error handling
- [x] Clear logging with `[oclitellmac-server]` prefix
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
   npm install
   ```

2. **Create configuration:**
   ```bash
   mkdir -p ~/.config/oclitellmac
   cp server/config-example.json ~/.config/oclitellmac/server.json
   # Edit with your LiteLLM endpoints
   ```

3. **Add to OpenCode:**
   ```bash
   opencode plugin add /path/to/plugins/oclitellmac
   ```
   
   Add to `opencode.json`:
   ```json
   {
     "plugin": ["oclitellmac/server", "oclitellmac/tui"]
   }
   ```

4. **Restart OpenCode**

## 🧪 Testing Checklist

### Pre-Test Setup
- [ ] npm install completed successfully
- [ ] Configuration file created at `~/.config/oclitellmac/server.json`
- [ ] At least one endpoint configured with valid URL and API key
- [ ] Plugin added to OpenCode

### Basic Functionality Tests
- [ ] OpenCode starts without errors
- [ ] Look for `[oclitellmac-server] Loaded configuration` in logs
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
- [ ] Send a chat message
- [ ] Check budget file is updated after message
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
      supported level as `{ "<level>": { "reasoningEffort": "<level>" } }`

### Error Handling Tests
- [ ] Invalid JSON in config file - check error message
- [ ] Missing config file - check graceful handling
- [ ] Invalid API key - check fallback behavior
- [ ] Unreachable endpoint with no cache - check skip behavior

## 📊 Expected Log Output

```
[oclitellmac-server] Loaded configuration from /home/user/.config/oclitellmac/server.json
[oclitellmac-server] Config hook: Injecting providers...
[oclitellmac-server] Fetching models for my-litellm from https://litellm.example.com...
[oclitellmac-server] Loaded 15 models for my-litellm
[oclitellmac-server] Started budget tracking for my-litellm (interval: 60s)
[oclitellmac-server] Provider injection complete: 1 fresh, 0 cached, 0 failed
[oclitellmac-server] Budget data updated for my-litellm
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
- Check OpenCode logs for error messages

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
6. ✅ Budget data updates periodically and after messages
7. ✅ Fallback to cache works when endpoint is unreachable
8. ✅ Clear log messages with `[oclitellmac-server]` prefix

## 🎉 Next Steps

Once verified working:
1. **TUI plugin** (`oclitellmac/tui`) is already included - verify budget display in sidebar
2. **Add configuration hot-reload** (watch `server.json` for changes)
3. **Implement retry logic** with exponential backoff
4. **Add health checks** for endpoint availability monitoring

---

**Status:** ✅ Implementation Complete - Ready for Testing!
