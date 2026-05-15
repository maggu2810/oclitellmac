# Documentation Index

This directory contains comprehensive documentation for the oclitellmac plugin.

## User Guides

### [INSTALL.md](INSTALL.md)
Step-by-step installation guide for local development and testing. Covers plugin registration, configuration file setup, verification steps, and platform-specific paths.

### [CONFIGURATION.md](CONFIGURATION.md)
Complete configuration reference for the server plugin. Includes endpoint configuration, global options, model category filtering, and advanced configuration examples.

### [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
Common issues and solutions for server plugin loading, TUI display, budget tracking, endpoint connectivity, and model availability.

## Reference Documentation

### [PATH-STRATEGY.md](PATH-STRATEGY.md)
Rationale for XDG Base Directory Specification usage and Unix-style paths across all platforms. Explains path management strategy and alternative approaches considered.

## Development Documentation

### [DEVELOPMENT.md](DEVELOPMENT.md)
Development guide covering build process, dependency management, import conventions, type checking, and testing procedures.

### [PUBLISH.md](PUBLISH.md)
Step-by-step guide for publishing the plugin to npm registry, including versioning, building, verification, and troubleshooting.

### Server Plugin Technical Documentation

- [../server/README.md](../server/README.md) — Server plugin implementation details, field mapping, and LiteLLM API integration
- [../server/ARCHITECTURE.md](../server/ARCHITECTURE.md) — Modular pipeline architecture (fetch → categorize → map → build → filter)
- [../server/IMPLEMENTATION.md](../server/IMPLEMENTATION.md) — Implementation details and technical summary
- [../server/VERIFICATION.md](../server/VERIFICATION.md) — Testing checklist and verification steps

### TUI Plugin Technical Documentation

- [../tui/README.md](../tui/README.md) — TUI plugin architecture, component structure, file watching, and signal management

## Agent Instructions

### [docu-handling.md](docu-handling.md)
Instructions for regenerating the root README.md for npm publication. Defines what content to include/exclude and how to maintain documentation structure.

### [agents-file-conventions.md](agents-file-conventions.md)
Conventions for AGENTS.md files and cost optimization strategies when working with AI assistants.

### [opencode-plugin-cli.md](opencode-plugin-cli.md)
OpenCode plugin CLI commands and specification format reference.
