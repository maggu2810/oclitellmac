# Troubleshooting Guide

This guide covers common issues when using the oclitellmac plugin.

## Table of Contents

1. [Server Plugin Not Loading](#server-plugin-not-loading)
2. [Endpoint Unreachable](#endpoint-unreachable)
3. [Models Not Appearing](#models-not-appearing)
4. [TUI Shows "Waiting for server..."](#tui-shows-waiting-for-server)
5. [Budget Not Updating](#budget-not-updating)
6. [Configuration File Issues](#configuration-file-issues)
7. [OpenCode v2 Plugin Errors](#opencode-v2-plugin-errors)
8. [Anthropic Route Errors](#anthropic-route-errors)

## Log Locations

- Server plugin: `~/.local/state/oclitellmac/server.log` (the server plugin context has no logging API, so the plugin writes its own log)
- TUI plugin: under `~/.local/state/oclitellmac/log/`
- Config: `~/.config/oclitellmac/server.json`; state: `~/.local/state/oclitellmac/` (`providers/`, `key-info/`)

---

## Server Plugin Not Loading

### Symptoms
- No providers appear in OpenCode model picker
- Nothing in `~/.local/state/oclitellmac/server.log`
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

3. **Check the server log** (`~/.local/state/oclitellmac/server.log`) for error messages:
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
   - Check `~/.config/opencode/opencode.jsonc` lists the plugin under `plugin` (or `plugins`)
   - `opencode plugin list` should show `oclitellmac`
   - For a local checkout the path must be the built `dist/` directory, see [OpenCode v2 Plugin Errors](#opencode-v2-plugin-errors)
   - Registration details: [read here](opencode-plugin-cli.md) when you need config file or spec rules

---

## Endpoint Unreachable

### Symptoms
- "Using cached data" warnings in `~/.local/state/oclitellmac/server.log`
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
- `server.log` shows the provider loaded successfully

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
   - Check `~/.local/state/oclitellmac/server.log`
   - Look for configuration loading, model fetching and budget tracking entries

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
   - Check `~/.local/state/oclitellmac/server.log` for recent entries

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
   - Check the TUI log under `~/.local/state/oclitellmac/log/` for file watch warnings

---

## Configuration File Issues

### Symptoms
- "Failed to load config" in `~/.local/state/oclitellmac/server.log`
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

## OpenCode v2 Plugin Errors

### "Plugin must export a default definition with an id and an effect or setup function"

**Cause:** The loaded server entry is a V1 build (`export default async function(input)`), for example the `oclitellmac@0.4.0` npm release.

**Fix:** Use a build made for OpenCode v2 (0.6.0 or later, or a local `bun run build`).

### "Invalid V2 TUI plugin module"

**Cause:** The TUI entry exports the V1 shape `{ id, tui }` instead of `{ id, setup(ctx) }`.

**Fix:** Same as above: use a v2 build.

### "Cannot find package '@opencode/ai'"

**Cause:** A model uses a provider package that is not bundled in the opencode binary (for example `@opencode/ai/providers/anthropic-compatible`). Plugins can only use the bundled providers; oclitellmac uses `openai-compatible` and `anthropic`.

**Fix:** Update to a current oclitellmac build. If you modified the plugin, only reference bundled provider packages.

### Plugin silently not loading from a local path

**Cause:** The configured path points at the project root. For a local path OpenCode resolves `<dir>/server` and `<dir>/tui` on the filesystem and ignores `package.json` `exports`; the root has no such files.

**Fix:** Run `bun run build` and register the absolute path of the `dist/` directory. See [read here](opencode-plugin-cli.md) when you need the local-path rules.

---

## Anthropic Route Errors

### `budget_exceeded` or 404 on `/v1/messages`

**Cause:** Claude models (default `anthropicModels: ["claude-*"]`) use the Anthropic-native route. The gateway must expose `POST <baseUrl>/v1/messages`; a 404 means it does not, and `budget_exceeded` is the gateway rejecting the key's budget on that route.

**Fix:** Verify the gateway exposes `/v1/messages` and check the key budget (`/key/info`). To send a model through the OpenAI-compatible route instead, adjust `anthropicModels`; see [read here](CONFIGURATION.md) when configuring `anthropicModels`.

---

## Additional Help

If none of the above solutions work:

1. **Check OpenCode version compatibility**:
   - Plugin requires OpenCode v2
   - Run `opencode --version` to check version

2. **Review full logs**:
   - Server log and TUI log, see [Log Locations](#log-locations)
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
