#!/usr/bin/env bun

// This script runs `bun install` first to ensure all dependencies
// (including @opentui/solid/bun-plugin) exist in node_modules

import pkg from "../package.json"
import { $ } from "bun"

console.log("Installing dependencies...")
await $`bun install`.quiet()

const { createSolidTransformPlugin } = await import("@opentui/solid/bun-plugin")

// Only mark `dependencies` as external — these are installed by arborist
// and resolved at runtime from the plugin's node_modules.
//
// devDependencies (@opentui/solid, solid-js) are bundled:
// - They are skipped by arborist during plugin install (no node_modules)
// - OpenCode is a compiled binary — they don't exist on disk to resolve
// - Solution: bundle them into dist/server.js and dist/tui.js
//
// Why @opentui/core and @opentui/keymap are in dependencies (not devDependencies):
// - Pre-bundled .js files use standard Node.js resolution (filesystem walk)
// - Bun's embedded packages are only available for on-the-fly .tsx transpilation
// - External imports in dist/tui.js need actual node_modules/@opentui/core
// - Arborist installs dependencies during GitHub plugin install
// - Result: @opentui/core installed → external imports resolve successfully
//
// Version pinning requirement:
// - @opentui/core and @opentui/keymap MUST be pinned to the exact version
//   compiled into the OpenCode binary (check opencode repo's package.json catalog)
// - Mismatched versions cause registerEnvVar() conflicts (different descriptions)
// - Current OpenCode binary uses 0.2.6 (see repos/opencode/package.json catalog)
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
]

const solidPlugin = createSolidTransformPlugin()

console.log("Building server plugin...")
const serverResult = await Bun.build({
  entrypoints: ["./server/src/index.ts"],
  outdir: "./dist",
  naming: "server.js",
  format: "esm",
  target: "bun",
  external,
})

if (!serverResult.success) {
  console.error("Server build failed:")
  for (const log of serverResult.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log("Building TUI plugin...")
const tuiResult = await Bun.build({
  entrypoints: ["./tui/src/index.tsx"],
  outdir: "./dist",
  naming: "tui.js",
  format: "esm",
  target: "bun",
  plugins: [solidPlugin],
  external,
})

if (!tuiResult.success) {
  console.error("TUI build failed:")
  for (const log of tuiResult.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log("✓ Build complete: dist/server.js, dist/tui.js")
