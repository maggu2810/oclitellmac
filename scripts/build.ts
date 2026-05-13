#!/usr/bin/env bun

// This script runs `bun install` first to ensure all dependencies
// (including @opentui/solid/bun-plugin) exist in node_modules

import pkg from "../package.json"
import { $ } from "bun"

console.log("Installing dependencies...")
await $`bun install`.quiet()

const { createSolidTransformPlugin } = await import("@opentui/solid/bun-plugin")

// Externalize all packages from dependencies, devDependencies, and peerDependencies.
//
// Why this approach:
// - dependencies (@opencode-ai/plugin, @opencode-ai/sdk, xdg-basedir, zod):
//   Installed by arborist during plugin install, resolved from node_modules at runtime.
//
// - devDependencies (@opentui/*, solid-js):
//   Also declared as optional peerDependencies → arborist skips installation.
//   OpenCode binary provides these at runtime via embedded module resolution.
//
// - peerDependencies (@opentui/*):
//   Declared with peerDependenciesMeta.optional: true → arborist skips installation.
//   Binary resolves at runtime → ensures single shared instance (critical for RendererContext).
//
// Version pinning requirement:
// - @opentui/* packages in devDependencies are pinned to match the OpenCode binary version (0.2.6).
// - Check repos/opencode/package.json catalog for the current version.
// - Mismatched versions cause registerEnvVar() conflicts or RendererContext isolation.
const external = [
  ...new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ])
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
