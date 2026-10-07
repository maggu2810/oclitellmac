# Known Issues

Open items for the oclitellmac plugin. Remove an entry when it is fixed.

## Anthropic route not yet validated end to end

**Status**: open, needs a manual check.

Still to do in a live OpenCode session against a LiteLLM gateway:

- Enable `options.cachePrefixDiagnostics` in `server.json` and confirm that primary requests log `cache_control_present: true` and a stable `stable_prefix_hash` across steps.
- Run the two-call cache check directly against the gateway: two identical requests with a large stable prefix and `cache_control`; the second should report a large `cache_read_input_tokens`.

For the exact steps, [read here](../server/VERIFICATION.md).

## TUI watcher polls forever when `key-info/` is missing at startup

**Status**: open.

`BudgetWatcher.start()` in `tui/src/watcher.ts` tries `fs.watch` once. If the directory does not exist yet (the TUI started before the server plugin wrote its first budget file), it falls back to polling every 5 seconds and never switches back to file watching.

Possible fix: create the directory before watching, or retry `fs.watch` from the polling timer once it succeeds.

## Keys without a budget limit show as parse errors

**Status**: open.

`BudgetLoader` in `tui/src/loader.ts` requires `keyInfo.info.max_budget` to be a number. LiteLLM returns `null` for keys without a limit, so those providers are rejected with "missing or invalid keyInfo.info fields" and the sidebar shows a parse error.

Possible fix: treat a missing `max_budget` as "no limit" and show spend only, without a percentage bar or remaining amount.
