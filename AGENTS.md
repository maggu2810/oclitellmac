# oclitellmac - OpenCode LiteLLM Auto-Config

Unified plugin combining server and TUI functionality for LiteLLM integration.

## Overview

- **Entry Points**: `oclitellmac/server` (provider injection), `oclitellmac/tui` (sidebar display)
- **Purpose**: Auto-discovery and configuration of LiteLLM models with budget tracking
- **Architecture**: Producer-consumer (server writes → TUI reads, no TUI API calls)

## Critical Constants

- **Config**: `~/.config/oclitellmac/server.json` (XDG-compliant, see PATH-STRATEGY.md)
- **State**: `~/.local/state/oclitellmac/` (providers cache, budget data)
- **Installation**: `opencode plugin github:maggu2810/oclitellmac` or `opencode plugin add <path>`

## Features

- Multiple LiteLLM endpoints as separate providers
- Smart caching with fallback when endpoints unreachable
- Automatic authentication injection (no OpenCode auth store needed)
- Category filtering (non-chat models blacklisted by default)
- Real-time budget display in sidebar
- Cross-platform XDG path support (Linux/macOS/Windows)
- LiteLLM compatibility workaround (automatic `_noop` tool injection)

## File Reading Instructions

For AGENTS.md conventions and token cost optimization:
Read @docs/agents-file-conventions.md

When understanding path management (XDG compliance, cross-platform):
Read @PATH-STRATEGY.md

When working on server plugin field mapping or LiteLLM API integration:
Read @server/README.md (includes field mapping priority and LiteLLM compatibility)

When understanding server architecture or pipeline stages:
Read @server/ARCHITECTURE.md

When implementing server features or fixing bugs:
Read @server/IMPLEMENTATION.md

When testing or verifying server functionality:
Read @server/VERIFICATION.md

When working on TUI components or file watching:
Read @tui/README.md
