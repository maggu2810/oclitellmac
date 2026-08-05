# Publishing to npm

This guide covers the steps to publish the oclitellmac plugin to the npm registry.

This plugin uses `bun` for building and publishing (matches the tracked `bun.lock`
lockfile and the OpenCode project's own package manager). `npm` is only used for
the one-time login step below — `bun` has no independent login flow and reads the
same `~/.npmrc` auth token that `npm login` writes.

## Prerequisites

### 1. npm Account

Create an account at [npmjs.com](https://www.npmjs.com) if you don't have one.

### 2. Local Authentication

Log in to npm locally (one-time setup):

```bash
npm login
```

This saves your credentials to `~/.npmrc` and persists across sessions. You only
need to run this once per machine. `bun publish` and `bun pm` commands read this
same token — there is no separate `bun login`.

---

## Publishing a New Version

### Step 1: Build the Plugin

The plugin must be built before publishing. The build process compiles TypeScript source to JavaScript in the `dist/` directory.

```bash
cd plugins/oclitellmac
bun run build
```

**Expected output:**
```
Installing dependencies...
Building server plugin...
Building TUI plugin...
✓ Build complete: dist/server.js, dist/tui.js
```

**Verify build output:**
```bash
ls -lh dist/
```

You should see:
- `dist/server.js` — Server plugin bundle
- `dist/tui.js` — TUI plugin bundle

### Step 2: Verify Tarball Contents (Dry Run)

Before publishing, verify what files will be included in the package:

```bash
bun pm pack --dry-run
```

**Expected files:**
- `package.json` — Package metadata (always included)
- `README.md` — Package homepage (always included)
- `LICENSE` — License file (always included)
- `dist/server.js` — Server plugin bundle (from `"files": ["dist/"]`)
- `dist/tui.js` — TUI plugin bundle (from `"files": ["dist/"]`)

**Files that should NOT appear:**
- Source files (`server/src/`, `tui/src/`)
- Documentation files (`docs/`, `DEVELOPMENT.md`, `INSTALL.md`, etc.)
- Build scripts (`scripts/`)
- Lock files (`bun.lock`)
- Any other repository files

If unexpected files appear, check the `"files"` field in `package.json` — it should contain only `["dist/"]`.

### Step 3: Publish

Publish the package to npm:

```bash
bun publish --access public
```

**About the `--access public` flag:**
- **Scoped packages** (e.g., `@username/package`): Default to private. Use `--access public` to publish publicly.
- **Unscoped packages** (e.g., `package`): Default to public. The `--access public` flag is optional but harmless.

To always publish publicly regardless of package type, include the flag.

**Alternative** — Omit the flag for unscoped packages:
```bash
bun publish
```

**Expected output:**
```
bun publish v1.3.3 (ca7428e9)

packed 1.5kB package.json
packed 6.0kB README.md
packed 1.1kB LICENSE
packed 21.5kB dist/server.js
packed 17.2kB dist/tui.js

Total files: 5
Shasum: 839ace2e087f25ef75455a82c1eeb21196ab75a7
Integrity: sha512-VGmg9DFVLN546[...]HBaQLMXp01D8A==
Unpacked size: 47.3kB
Packed size: 12.7kB
Tag: latest
Access: public
Registry: https://registry.npmjs.org/

 + oclitellmac@0.4.0
```

### Step 4: Verify Publication

Check the package page on npmjs.com:
```
https://www.npmjs.com/package/oclitellmac
```

---

## Publishing Future Releases

### Version Bump Workflow

Use bun's built-in versioning command:

**Patch release** (bug fixes, no new features):
```bash
bun pm version patch
```

**Minor release** (new features, backward compatible):
```bash
bun pm version minor
```

**Major release** (breaking changes):
```bash
bun pm version major
```

This automatically:
1. Updates `package.json` version
2. Creates a git commit
3. Creates a git tag

### Full Release Workflow

```bash
# 1. Make your code changes and commit them
git add .
git commit -m "feat: add new feature"

# 2. Bump version (creates commit + tag)
bun pm version minor

# 3. Build the plugin
bun run build

# 4. Verify tarball (optional but recommended)
bun pm pack --dry-run

# 5. Publish
bun publish --access public

# 6. Push commits and tags to GitHub
git push && git push --tags
```

---

## Troubleshooting

### Error: `401 Unauthorized` on `whoami`, `404 Not Found - PUT .../<package>` on publish

**Cause:** The auth token saved in `~/.npmrc` is expired, revoked, or otherwise
invalid. npm's registry intentionally returns `404` (not `401`/`403`) for a
publish `PUT` from an unauthorized caller — this avoids leaking whether a
package name exists to callers without write access. It looks like a
package-name or permission problem, but it's really an invalid credential.

**Diagnose:**
```bash
npm whoami
```
If this also fails with `401 Unauthorized`, the token itself is the problem —
not the package name, not `--access public`, not scope ownership.

**Solution:** Re-run `npm login` to obtain a fresh token (rewrites `~/.npmrc`).
`bun publish` and `bun pm` commands share this same token; there is no
separate `bun login`.

### Error: `402 Payment Required`

**Cause:** Trying to publish a scoped package as private without a paid npm account.

**Solution:** Add `--access public` to the publish command.

### Error: `403 Forbidden`

**Cause:** Not logged in or insufficient permissions.

**Solutions:**
1. Run `npm login` and authenticate
2. Verify you own the package name (for updates)
3. Check your npm account has publish permissions

### Error: `code ENOENT`

**Cause:** `dist/` directory missing.

**Solution:** Run `bun run build` before publishing.

### Error: `404 Not Found - PUT https://registry.npmjs.org/@scope/package`

**Cause:** Scope doesn't exist on npm (first publish of a scoped package).

**Solution:** 
1. Verify the scope matches your npm username
2. Add `--access public` flag
3. Ensure you're logged in to the correct npm account
4. If `npm whoami` also fails, see the auth-token entry above first

### Warning: Files in tarball look wrong

**Cause:** `"files"` field in `package.json` is incorrect or `dist/` wasn't built.

**Solutions:**
1. Check `"files": ["dist/"]` in `package.json`
2. Run `bun run build` to generate `dist/`
3. Run `bun pm pack --dry-run` to verify before publishing

---

## Related Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md) — Build process details
- [README.md](../README.md) — Package overview (shown on npmjs.com)
- [npm documentation](https://docs.npmjs.com/) — Official npm publishing guide
- [bun publish documentation](https://bun.sh/docs/cli/publish) — Official bun publish reference
