# Documentation Handling Guide

This document provides instructions for maintaining the oclitellmac plugin documentation structure, specifically how to regenerate the root `README.md` for npm publication.

## Documentation Structure

### Root `README.md` — npm Package Homepage

**Location**: `/plugins/oclitellmac/README.md`

**Purpose**: Displayed on npmjs.com as the package homepage. This file is **always** included in the npm tarball regardless of the `"files"` field in `package.json`.

**Audience**: npm package users who want to install and use the plugin in OpenCode.

**Critical Rule**: **No relative markdown links** — they break on npmjs.com because the linked files are not in the tarball. Use plain text references to the GitHub repository instead.

### `docs/` Directory — Full Documentation

**Location**: `/plugins/oclitellmac/docs/`

**Purpose**: Comprehensive documentation for installation, configuration, development, and troubleshooting. Not included in npm tarball (excluded by `"files": ["dist/"]` in `package.json`).

**Audience**: Developers, contributors, and advanced users who clone the GitHub repository.

**Entry Point**: `docs/README.md` — table of contents for all documentation files.

---

## Regenerating Root `README.md`

When significant features are added or configuration changes, the root `README.md` may need updating. Use this guide to regenerate it correctly.

### What to Include

1. **Title + One-Sentence Description**
   - Package name and tagline
   - Example: `**OpenCode LiteLLM Auto-Config** - Unified plugin for automatic LiteLLM proxy configuration and budget tracking.`

2. **What It Does** (2–3 sentences)
   - Briefly explain server + TUI functionality
   - Emphasize zero-config provider setup and file-based TUI updates
   - **Source**: First paragraph of `docs/README.md` or `docs/INSTALL.md` overview

3. **Features** (two bullet lists)
   - Server plugin features (7–8 bullets)
   - TUI plugin features (6–7 bullets)
   - **Keep emojis** — they render correctly on npmjs.com
   - **Source**: Current root `README.md` Features section (lines 31–46)

4. **TUI Display** (visual preview)
   - ASCII art provider card example
   - Color coding explanation (green/yellow/red with usage thresholds)
   - Timestamp display format
   - **Why keep**: Helps users visualize the plugin before installing
   - **Source**: Current root `README.md` TUI Display section (lines 113–143)

5. **Requirements**
   - OpenCode with plugin support
   - LiteLLM proxy endpoint(s)
   - **Exclude**: Node.js version (dev-only requirement, not relevant for npm users)
   - **Source**: Current root `README.md` Requirements section (lines 244–248)

6. **Installation**
   - **Only npm install**: `opencode plugin @maggu2810/oclitellmac`
   - Mention `--global` flag for global installation
   - **Exclude**: GitHub install (blocked by OpenCode bug), local development (belongs in `docs/DEVELOPMENT.md`)
   - **Source**: New content, not from existing files

7. **Configuration** (inline examples)
   - **Minimal Example** (4–5 lines):
     ```json
     {
       "endpoints": [{
         "baseUrl": "https://your-litellm-proxy.example.com",
         "apiKey": "sk-your-api-key",
         "providerKey": "my-litellm",
         "providerName": "My LiteLLM Proxy",
         "enabled": true
       }]
     }
     ```
     - **Must include `providerName`** with a note explaining it's optional but controls the TUI display name (vs. auto-formatted from `providerKey`)
     - **Source**: `docs/CONFIGURATION.md` Quick Start Configuration (lines 77–87), enhanced with `providerName`
   
   - **Full Example** (multiple endpoints + options):
     - Show 2–3 endpoints with different settings
     - Include all `options` fields (`timeout`, `budgetPollInterval`, `fallbackToCache`)
     - Include category filtering examples (`enabledCategories`, `enableAllCategories`)
     - **Source**: `docs/CONFIGURATION.md` Multiple Endpoints Example (lines 347–380)

8. **Troubleshooting** (one sentence, textual reference)
   - Example: "See the `docs/TROUBLESHOOTING.md` file in the [project repository](https://github.com/maggu2810/oclitellmac) for common issues and solutions."
   - **Why one sentence**: Full troubleshooting content is in `docs/TROUBLESHOOTING.md` (50+ lines), too long for npm README
   - **Allow this one hyperlink**: Link to the GitHub repository (external URL, works on npmjs.com)

9. **Further Documentation** (plain text reference, no links)
   - Example: "Full documentation including installation guide, configuration reference, path strategy, and development guide is available in the `docs/` directory of the project repository at https://github.com/maggu2810/oclitellmac."
   - **Critical**: Plain text only — do NOT use markdown links to `docs/INSTALL.md`, `docs/CONFIGURATION.md`, etc. They break on npmjs.com.

10. **License**
    - `MIT`

### What to Exclude

- **Architecture / How It Works** — Implementation details, belongs in `docs/DEVELOPMENT.md` and `server/ARCHITECTURE.md`
- **Startup Flow / Runtime Flow** — Internal behavior, not useful for npm users
- **Budget Data Format JSON** — Internal file structure, belongs in `tui/README.md`
- **Technical References section** — All relative links, useless on npmjs.com
- **Cross-reference links** — `[INSTALL.md](INSTALL.md)`, `[CONFIGURATION.md](CONFIGURATION.md)`, etc. — they break on npmjs.com
- **Path Management detailed section** — Summary is fine, full details belong in `docs/PATH-STRATEGY.md`

### Source Files

When regenerating, draw content from:

1. **`docs/CONFIGURATION.md`**:
   - Minimal configuration example (lines 77–87, add `providerName`)
   - Full configuration example (lines 347–380)

2. **Current root `README.md`**:
   - Features section (lines 31–46) — copy as-is
   - TUI Display section (lines 113–143) — copy as-is

3. **`docs/TROUBLESHOOTING.md`**:
   - Referenced textually (one sentence in Troubleshooting section)

4. **New content**:
   - Installation section (npm-only)
   - Further Documentation section (plain text reference to GitHub repo)

### Configuration Section Rules

1. **Minimal example must include `providerName`**:
   ```json
   "providerName": "My LiteLLM Proxy"
   ```
   Followed by: "The `providerName` field is optional but recommended — it controls the display name shown in the OpenCode model picker and TUI sidebar. If omitted, the plugin auto-formats the `providerKey` (e.g., `my-litellm` → `My Llm`)."

2. **Full example must include**:
   - Multiple endpoints (2–3) with different settings
   - All `options` fields: `timeout`, `budgetPollInterval`, `fallbackToCache`
   - At least one endpoint with category filtering (`enabledCategories` or `enableAllCategories`)

### Hyperlink Policy

**General Rule**: No markdown links to relative paths. They break on npmjs.com.

**Exceptions**:
1. External URLs (XDG spec, GitHub, etc.) — work fine
2. The GitHub repository link in Troubleshooting section — allowed as it's external
3. The GitHub repository URL in Further Documentation section — allowed as it's external

**Forbidden**:
- `[INSTALL.md](INSTALL.md)` ❌
- `[docs/CONFIGURATION.md](docs/CONFIGURATION.md)` ❌
- `[server/README.md](server/README.md)` ❌

**Allowed**:
- `[XDG Base Directory Specification](https://specifications.freedesktop.org/...)` ✅
- `[project repository](https://github.com/maggu2810/oclitellmac)` ✅

---

## Documentation File Locations

| File | Location | Purpose |
|---|---|---|
| `README.md` | Root | npm package homepage (lean, user-facing) |
| `docs/README.md` | `docs/` | Entry point for all documentation |
| `docs/INSTALL.md` | `docs/` | Installation and verification guide |
| `docs/CONFIGURATION.md` | `docs/` | Configuration reference |
| `docs/TROUBLESHOOTING.md` | `docs/` | Common issues and solutions |
| `docs/PATH-STRATEGY.md` | `docs/` | XDG path management rationale |
| `docs/DEVELOPMENT.md` | `docs/` | Development guide |
| `server/README.md` | `server/` | Server plugin technical details |
| `server/ARCHITECTURE.md` | `server/` | Server pipeline architecture |
| `server/IMPLEMENTATION.md` | `server/` | Server implementation summary |
| `server/VERIFICATION.md` | `server/` | Server testing checklist |
| `tui/README.md` | `tui/` | TUI plugin technical reference |

---

## Example Regeneration Prompt

When asking an AI assistant to regenerate `README.md`:

> "Regenerate the root `README.md` for npm publication following the guidelines in `docs/docu-handling.md`. The README must:
> - Be lean and user-facing (npm package homepage)
> - Include Features, TUI Display, Requirements, Installation (npm only), Configuration (minimal + full examples with `providerName` note), Troubleshooting (one sentence), Further Documentation (plain text), and License
> - Exclude Architecture, How It Works, Budget Data Format, and all relative markdown links
> - Source content from `docs/CONFIGURATION.md` (config examples), current `README.md` (Features + TUI Display), and `docs/TROUBLESHOOTING.md` (textual reference)
> - Use only external URLs for links (no relative paths)"

---

## Maintenance Notes

- **When to update**: After significant feature additions, configuration changes, or TUI layout changes
- **What stays stable**: Features list, TUI Display section, Requirements
- **What changes frequently**: Configuration examples (when new fields added), Installation instructions (if install method changes)
- **Version alignment**: Ensure configuration examples match the current `docs/CONFIGURATION.md` schema
