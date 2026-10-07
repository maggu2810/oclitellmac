# OpenCode Plugin CLI Reference

Source-verified reference for plugin registration in OpenCode v2: CLI commands,
spec formats, config files, and local-path rules. Other docs link here instead
of restating it.

## Commands

```bash
opencode plugin list [--builtin]
opencode plugin add <package>
opencode plugin check [target]
opencode plugin update [target]
opencode plugin remove <package>
```

There is no `--global`, `--force`, `-g` or `-f` flag and no bare
`opencode plugin <module>` form. Run `opencode plugin --help` for the current list.

### `add`

- Accepts only an npm registry or Git package specifier. Local paths are
  rejected with "Plugin target must be an npm registry package or Git package
  specifier".
- Installs the package via npm (arborist/pacote).
- Always writes the global config: a package with a server entrypoint is added to
  the `plugins` array of the global opencode config; a TUI-only package is added
  to the `plugins` array of `cli.json`.

### Package specifier examples

```bash
opencode plugin add oclitellmac
opencode plugin add github:your-org/your-repo
opencode plugin add "github:your-org/your-repo#path:packages/my-plugin"
```

Package plugins need a release built for OpenCode v2. The `oclitellmac@0.4.0`
npm release is a V1 build; use 0.6.0 or later.

## Config Files

| File | Used for |
|---|---|
| `~/.config/opencode/opencode.jsonc` | Server config. Plugins are listed once under `plugin` (legacy name, still accepted) or `plugins` |
| `~/.config/opencode/cli.json` | V2 TUI/CLI config (key `plugins`) |

- A server plugin that also has a TUI entry is loaded in the TUI automatically
  (server inventory `features.tui`). Listing it once in the server config is enough.
- `cli.json` `plugins` is only needed for TUI-only plugins, per-plugin options,
  or disabling a plugin (entries starting with `-`).
- `tui.json` / `tui.jsonc` are not read by V2. They are imported into `cli.json`
  once, only when `cli.json` does not exist yet (same for
  `~/.local/state/opencode/kv.json`).

## Entry Resolution

For npm and Git packages, entries come from the `exports` map of `package.json`:
`./server` (falling back to `.`), `./tui`, `./rpc`.

For a local path in config:

- The path must be a directory. A file path is rejected with "configured plugin
  path must be a directory".
- Relative paths (`./`, `../`) resolve against the directory of the config file;
  `file://` URLs are accepted.
- V2 resolves `<dir>/server` (then `<dir>/index`) and `<dir>/tui` on the
  filesystem, like a bundler (for example `server.js`, `tui.js`).
  `package.json` `exports` is not consulted.
- oclitellmac builds to `dist/server.js` and `dist/tui.js` (`bun run build`), so
  register the absolute path of the `dist/` directory, not the project root.

Example:

```json
{
  "plugin": ["/abs/path/to/oclitellmac/dist"]
}
```

## Plugin Module Shapes

| Entry | Required default export |
|---|---|
| Server | `{ id, setup(ctx) }` or `{ id, effect }` (`@opencode/plugin`) |
| TUI | `{ id, setup(ctx) }` (`Plugin.Definition` from `@opencode/plugin/tui`) |

V1 shapes (`export default async function(input): Hooks`, `{ id, tui }`) fail to
load; see [Troubleshooting](TROUBLESHOOTING.md) for the exact errors.

## Further Reading

When installing oclitellmac, [read here](INSTALL.md)

When a plugin fails to load, [read here](TROUBLESHOOTING.md)
