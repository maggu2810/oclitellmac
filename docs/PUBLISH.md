# Publishing to npm

This guide covers the steps to publish the oclitellmac plugin to the npm registry.

## Prerequisites

### 1. npm Account

Create an account at [npmjs.com](https://www.npmjs.com) if you don't have one.

### 2. Local Authentication

Log in to npm locally (one-time setup):

```bash
npm login
```

This saves your credentials to `~/.npmrc` and persists across sessions. You only need to run this once per machine.

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

Before publishing, verify what files will be included in the npm package:

```bash
npm pack --dry-run
```

**Expected files:**
- `package.json` — Package metadata (always included)
- `README.md` — Package homepage (always included by npm)
- `LICENSE` — License file (always included by npm)
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
npm publish --access public
```

**About the `--access public` flag:**
- **Scoped packages** (e.g., `@username/package`): Default to private. Use `--access public` to publish publicly.
- **Unscoped packages** (e.g., `package`): Default to public. The `--access public` flag is optional but harmless.

To always publish publicly regardless of package type, include the flag.

**Alternative** — Omit the flag for unscoped packages:
```bash
npm publish
```

**Expected output:**
```
npm notice 
npm notice 📦  @maggu2810/oclitellmac@0.1.0
npm notice === Tarball Contents === 
npm notice 1.2kB package.json          
npm notice 4.5kB README.md             
npm notice 1.1kB LICENSE               
npm notice 45.2kB dist/server.js       
npm notice 23.1kB dist/tui.js          
npm notice === Tarball Details === 
npm notice name:          @maggu2810/oclitellmac                  
npm notice version:       0.1.0                                   
npm notice filename:      maggu2810-oclitellmac-0.1.0.tgz        
npm notice package size:  18.3 kB                                
npm notice unpacked size: 75.1 kB                                
npm notice shasum:        abc123...                              
npm notice integrity:     sha512-xyz789...                       
npm notice total files:   5                                      
npm notice 
npm notice Publishing to https://registry.npmjs.org/
+ @maggu2810/oclitellmac@0.1.0
```

### Step 4: Verify Publication

Check the package page on npmjs.com:
```
https://www.npmjs.com/package/@maggu2810/oclitellmac
```

(Replace `@maggu2810/oclitellmac` with your package name for unscoped packages.)

---

## Publishing Future Releases

### Version Bump Workflow

Use npm's built-in versioning commands:

**Patch release** (bug fixes, no new features):
```bash
npm version patch
```

**Minor release** (new features, backward compatible):
```bash
npm version minor
```

**Major release** (breaking changes):
```bash
npm version major
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
npm version minor

# 3. Build the plugin
bun run build

# 4. Verify tarball (optional but recommended)
npm pack --dry-run

# 5. Publish
npm publish --access public

# 6. Push commits and tags to GitHub
git push && git push --tags
```

---

## Troubleshooting

### Error: `npm ERR! 402 Payment Required`

**Cause:** Trying to publish a scoped package as private without a paid npm account.

**Solution:** Add `--access public` to the publish command.

### Error: `npm ERR! 403 Forbidden`

**Cause:** Not logged in or insufficient permissions.

**Solutions:**
1. Run `npm login` and authenticate
2. Verify you own the package name (for updates)
3. Check your npm account has publish permissions

### Error: `npm ERR! code ENOENT`

**Cause:** `dist/` directory missing.

**Solution:** Run `bun run build` before publishing.

### Error: `npm ERR! 404 Not Found - PUT https://registry.npmjs.org/@scope/package`

**Cause:** Scope doesn't exist on npm (first publish of a scoped package).

**Solution:** 
1. Verify the scope matches your npm username
2. Add `--access public` flag
3. Ensure you're logged in to the correct npm account

### Warning: Files in tarball look wrong

**Cause:** `"files"` field in `package.json` is incorrect or `dist/` wasn't built.

**Solutions:**
1. Check `"files": ["dist/"]` in `package.json`
2. Run `bun run build` to generate `dist/`
3. Run `npm pack --dry-run` to verify before publishing

---

## Related Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md) — Build process details
- [README.md](../README.md) — Package overview (shown on npmjs.com)
- [npm documentation](https://docs.npmjs.com/) — Official npm publishing guide
