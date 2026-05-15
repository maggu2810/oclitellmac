# Troubleshooting Guide

This guide covers common issues when using the oclitellmac plugin.

## Table of Contents

1. [Server Plugin Not Loading](#server-plugin-not-loading)
2. [Endpoint Unreachable](#endpoint-unreachable)
3. [Models Not Appearing](#models-not-appearing)
4. [TUI Shows "Waiting for server..."](#tui-shows-waiting-for-server)
5. [Budget Not Updating](#budget-not-updating)
6. [Configuration File Issues](#configuration-file-issues)

---

## Server Plugin Not Loading

### Symptoms
- No providers appear in OpenCode model picker
- No `[oclitellmac]` messages in OpenCode logs
- Models from LiteLLM endpoints not available

### Solutions

1. **Check configuration file exists**:
   ```bash
   # Linux/macOS
   ls -la ~/.config/oclitellmac/server.json
   
   # Windows (PowerShell)
   dir $HOME\.config\oclitellmac\server.json
   ```

2. **Verify JSON syntax is valid**:
   ```bash
   jq . < ~/.config/oclitellmac/server.json
   ```
   
   If `jq` is not installed, check the file manually for:
   - Missing commas between fields
   - Unclosed quotes or brackets
   - Trailing commas (invalid in JSON)

3. **Check OpenCode logs for error messages**:
   - Look for `[oclitellmac]` prefix
   - Common errors: "Failed to load config", "Failed to fetch models"

4. **Ensure at least one endpoint has `"enabled": true`**:
   ```json
   {
     "endpoints": [
       {
         "baseUrl": "...",
         "apiKey": "...",
         "providerKey": "...",
         "enabled": true  // ← Must be true
       }
     ]
   }
   ```

5. **Verify plugin is registered in OpenCode config**:
   - Check `.opencode/opencode.json` contains plugin entry
   - For npm install: `opencode plugin list` should show `@maggu2810/oclitellmac`

---

## Endpoint Unreachable

### Symptoms
- "Using cached data" warnings in OpenCode logs
- Provider appears but with stale model list
- Budget data not updating

### Solutions

1. **Check if fallback is enabled** (default: `true`):
   - Plugin will fall back to cached data if `fallbackToCache: true` in config
   - Check `~/.local/state/oclitellmac/providers/` for cached data files
   - If no cached data exists, provider will fail to load

2. **Verify endpoint URL and API key are correct**:
   ```bash
   # Test endpoint manually (replace with your values)
   curl https://your-proxy.example.com/public/model_hub
   ```

3. **Check network connectivity**:
   - Firewall blocking requests?
   - VPN required?
   - Proxy server down?

4. **Increase timeout** if endpoint is slow:
   ```json
   {
     "options": {
       "timeout": 90  // Increased from default 30s
     }
   }
   ```

5. **Check endpoint returned valid response**:
   ```bash
   curl -H "Authorization: Bearer sk-your-key" \
        https://your-proxy.example.com/v1/model/info
   ```

---

## Models Not Appearing

### Symptoms
- Provider appears in model picker
- No models listed under the provider
- OpenCode logs show provider loaded successfully

### Solutions

1. **Ensure endpoint is enabled**:
   ```json
   "enabled": true
   ```

2. **Check that LiteLLM proxy is accessible**:
   ```bash
   curl https://your-proxy.example.com/public/model_hub
   ```
   
   Expected response: JSON array with model objects

3. **Verify non-chat models aren't accidentally blacklisted**:
   - By default, only **chat models** are shown
   - To enable embedding models, TTS, etc.:
     ```json
     {
       "enabledCategories": ["embedding", "audio_speech"]
     }
     ```
   - To enable **all** model types:
     ```json
     {
       "enableAllCategories": true
     }
     ```

4. **Check cached data** (if endpoint was reachable at least once):
   ```bash
   # Linux/macOS
   cat ~/.local/state/oclitellmac/providers/<provider-key>.json
   
   # Windows (PowerShell)
   cat $HOME\.local\state\oclitellmac\providers\<provider-key>.json
   ```
   
   Verify `models` array is not empty

5. **Restart OpenCode after configuration changes**:
   - Plugin only loads configuration at startup
   - Changes to `server.json` require restart

---

## TUI Shows "Waiting for server..."

### Symptoms
- No budget cards displayed in OpenCode sidebar
- "Key Info" section shows "Waiting for oclitellmac/server..."
- TUI plugin loaded but no data visible

### Solutions

1. **Verify server plugin is loaded**:
   - Check OpenCode logs for `[oclitellmac]` messages
   - Look for: "Loaded configuration", "Fetching models", "Started budget tracking"

2. **Check budget files exist**:
   ```bash
   # Linux/macOS
   ls -lh ~/.local/state/oclitellmac/key-info/
   
   # Windows (PowerShell)
   dir $HOME\.local\state\oclitellmac\key-info\
   ```
   
   Expected: One `.json` file per configured endpoint

3. **Verify budget files are valid JSON**:
   ```bash
   jq . < ~/.local/state/oclitellmac/key-info/*.json
   ```

4. **Wait 60 seconds for initial budget fetch**:
   - Server plugin polls `/key/info` every 60 seconds by default
   - First fetch happens on startup + 60s delay

5. **Check state directory path** (platform-specific):
   - **Linux (default)**: `~/.local/state/oclitellmac/`
   - **Linux (custom XDG)**: `$XDG_STATE_HOME/oclitellmac/`
   - **macOS**: `~/.local/state/oclitellmac/`
   - **Windows**: `C:\Users\<username>\.local\state\oclitellmac\`

6. **Restart OpenCode** to reset both plugins:
   - Server plugin may have failed silently
   - TUI plugin file watcher may need reset

---

## Budget Not Updating

### Symptoms
- TUI shows stale budget data
- `fetchedAt` timestamp is old
- Budget values don't change after sending messages

### Solutions

1. **Check server plugin is running**:
   - Look for `[oclitellmac]` logs with recent timestamps
   - Expected: "Budget data updated for <provider-key>"

2. **Verify `/key/info` endpoint is accessible**:
   ```bash
   curl -H "Authorization: Bearer sk-your-key" \
        https://your-proxy.example.com/key/info
   ```
   
   Expected response: JSON with `spend`, `max_budget`, etc.

3. **Check file timestamps**:
   ```bash
   # Linux/macOS
   ls -lh ~/.local/state/oclitellmac/key-info/
   
   # Windows (PowerShell)
   dir $HOME\.local\state\oclitellmac\key-info\
   ```
   
   Files should have recent modification times

4. **Verify file watcher is working**:
   - Send a chat message using a LiteLLM model
   - Server plugin should fetch budget immediately after message
   - TUI should update within ~100ms

5. **Check file permissions**:
   ```bash
   # Ensure user has write access to state directory
   ls -ld ~/.local/state/oclitellmac/
   ```

6. **Increase polling frequency** (if needed):
   ```json
   {
     "options": {
       "budgetPollInterval": 30  // Poll every 30s instead of 60s
     }
   }
   ```

7. **Restart OpenCode to reset file watcher**:
   - File watcher may have stopped due to error
   - Check OpenCode logs for file watch warnings

---

## Configuration File Issues

### Symptoms
- "Failed to load config" in OpenCode logs
- Plugin not starting
- Validation errors

### Solutions

1. **Create config file if missing**:
   ```bash
   # Linux/macOS
   mkdir -p ~/.config/oclitellmac
   cat > ~/.config/oclitellmac/server.json << 'EOF'
   {
     "endpoints": [
       {
         "baseUrl": "https://your-proxy.example.com",
         "apiKey": "sk-your-key",
         "providerKey": "my-litellm",
         "enabled": true
       }
     ]
   }
   EOF
   
   # Windows (PowerShell)
   $dir = "$HOME\.config\oclitellmac"
   if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir }
   @"
   {
     "endpoints": [
       {
         "baseUrl": "https://your-proxy.example.com",
         "apiKey": "sk-your-key",
         "providerKey": "my-litellm",
         "enabled": true
       }
     ]
   }
   "@ | Out-File -FilePath "$dir\server.json" -Encoding UTF8
   ```

2. **Validate JSON syntax**:
   - Use `jq` or an online JSON validator
   - Common errors:
     - Trailing commas: `"enabled": true,` in last field ❌
     - Missing quotes: `providerKey: my-litellmac` ❌
     - Wrong quotes: `"baseUrl": 'https://...'` ❌ (must use `"`)

3. **Check required fields are present**:
   - Each endpoint must have: `baseUrl`, `apiKey`, `providerKey`
   - Optional fields: `providerName`, `enabled`, `enabledCategories`, `enableAllCategories`

4. **Verify `providerKey` is unique**:
   ```json
   {
     "endpoints": [
       { "providerKey": "litellm-prod", ... },
       { "providerKey": "litellm-dev", ... },   // ✅ Unique
       { "providerKey": "litellm-prod", ... }   // ❌ Duplicate!
     ]
   }
   ```

5. **Use correct URL format** (no `/v1` suffix):
   ```json
   "baseUrl": "https://proxy.example.com"       // ✅ Correct
   "baseUrl": "https://proxy.example.com/v1"    // ❌ Wrong
   ```

6. **See example configuration**:
   - Full example: [`../server/config-example.json`](../server/config-example.json)
   - Complete reference: [CONFIGURATION.md](CONFIGURATION.md)

---

## Additional Help

If none of the above solutions work:

1. **Check OpenCode version compatibility**:
   - Plugin requires OpenCode with plugin support
   - Run `opencode --version` to check version

2. **Review full logs**:
   - Enable debug logging if available
   - Look for stack traces or detailed error messages

3. **Verify LiteLLM proxy is working**:
   - Test with OpenAI-compatible client directly
   - Ensure proxy is configured correctly

4. **File an issue**:
   - GitHub repository: https://github.com/maggu2810/oclitellmac
   - Include: OpenCode version, config file (redact API keys), relevant logs

---

## Related Documentation

- [INSTALL.md](INSTALL.md) — Installation and verification steps
- [CONFIGURATION.md](CONFIGURATION.md) — Full configuration reference
- [PATH-STRATEGY.md](PATH-STRATEGY.md) — Path management details
- [../server/VERIFICATION.md](../server/VERIFICATION.md) — Server testing checklist
