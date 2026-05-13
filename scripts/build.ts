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
// devDependencies (@opentui/solid, solid-js, etc.) are NOT marked external:
// - They are skipped by arborist during plugin install (no node_modules)
// - OpenCode is a compiled binary — they don't exist on disk to resolve
// - Solution: bundle them into dist/tui.js so they're self-contained
//
// Exception: @opentui/core and @opentui/keymap MUST be external even though
// they're in devDependencies, because:
// - @opentui/solid internally imports @opentui/core
// - @opentui/core registers global state — bundling causes duplicates
// - OpenCode provides these at runtime via the binary's internal resolution
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  "@opentui/core",
  "@opentui/keymap",
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
