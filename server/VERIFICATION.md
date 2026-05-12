# Server Plugin - Verification Checklist

## ✅ Files Created

- [x] `package.json` - Package configuration with dependencies
- [x] `tsconfig.json` - TypeScript configuration
- [x] `README.md` - User documentation
- [x] `IMPLEMENTATION.md` - Implementation details and summary
- [x] `config-example.json` - Example configuration file
- [x] `.gitignore` - Git ignore rules
- [x] `src/index.ts` - Main plugin entry point (5.1 KB)
- [x] `src/config.ts` - Configuration schema and loader (1.7 KB)
- [x] `src/state.ts` - State management with file locking (2.9 KB)
- [x] `src/fetcher.ts` - LiteLLM API client (4.2 KB)
- [x] `src/provider.ts` - Provider/model builder (3.6 KB)
- [x] `src/budget.ts` - Budget tracking logic (2.2 KB)

**Total:** 12 files, ~500 lines of TypeScript

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
- [x] Clear logging with `[oclitellmac]` prefix
- [x] Graceful degradation when endpoints fail
- [x] Enable/disable individual endpoints
- [x] Configurable timeouts

### Code Quality
- [x] TypeScript with strict mode
- [x] Type-safe configuration with `@effect/schema`
- [x] Modular architecture (6 source files)
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
- [ ] Look for `[oclitellmac] Loaded configuration` in logs
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

### Error Handling Tests
- [ ] Invalid JSON in config file - check error message
- [ ] Missing config file - check graceful handling
- [ ] Invalid API key - check fallback behavior
- [ ] Unreachable endpoint with no cache - check skip behavior

## 📊 Expected Log Output

```
[oclitellmac] Loaded configuration from /home/user/.config/oclitellmac/server.json
[oclitellmac] Config hook: Injecting providers...
[oclitellmac] Fetching models for my-litellm from https://litellm.example.com...
[oclitellmac] Loaded 15 models for my-litellm
[oclitellmac] Started budget tracking for my-litellm (interval: 60s)
[oclitellmac] Provider injection complete: 1 fresh, 0 cached, 0 failed
[oclitellmac] Budget data updated for my-litellm
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
8. ✅ Clear log messages with `[oclitellmac]` prefix

## 🎉 Next Steps

Once verified working:
1. **TUI plugin** (`oclitellmac/tui`) is already included - verify budget display in sidebar
2. **Add configuration hot-reload** (watch `server.json` for changes)
3. **Implement retry logic** with exponential backoff
4. **Add health checks** for endpoint availability monitoring

---

**Status:** ✅ Implementation Complete - Ready for Testing!
