# Known Issues

Open items for the oclitellmac plugin. Remove an entry when it is fixed.

## TUI watcher polls forever when `key-info/` is missing at startup

**Status**: open.

`BudgetWatcher.start()` in `tui/src/watcher.ts` tries `fs.watch` once. If the directory does not exist yet (the TUI started before the server plugin wrote its first budget file), it falls back to polling every 5 seconds and never switches back to file watching.

Possible fix: create the directory before watching, or retry `fs.watch` from the polling timer once it succeeds.

## Keys without a budget limit show as parse errors

**Status**: open.

`BudgetLoader` in `tui/src/loader.ts` requires `keyInfo.info.max_budget` to be a number. LiteLLM returns `null` for keys without a limit, so those providers are rejected with "missing or invalid keyInfo.info fields" and the sidebar shows a parse error.

Possible fix: treat a missing `max_budget` as "no limit" and show spend only, without a percentage bar or remaining amount.
