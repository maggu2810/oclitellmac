#!/usr/bin/env bun
// Prints a per-request prompt-cache table for one OpenCode session.
// Numbers come from OpenCode's database (read-only); with --log the prefix
// hashes from oclitellmac's server.log (options.cachePrefixDiagnostics) are
// joined by timestamp. No prompt content is read or printed.

import { Database } from "bun:sqlite"
import { readFileSync } from "fs"
import { homedir } from "os"
import path from "path"
import { parseArgs } from "util"

const HELP = `Usage: bun scripts/cache-report.ts [session-id] [options]

  session-id        Session to report (default: most recently updated session)

Options:
  --list            List recent sessions and exit
  --last <n>        Only the last n requests (default: all)
  --since <time>    Only requests after this time (ISO date or time, UTC)
  --model <text>    Only requests whose model id contains <text>
  --log             Join cachePrefixDiagnostics lines from server.log
  --format <f>      table (default) or markdown
  --db <path>       OpenCode database (default: $XDG_DATA_HOME/opencode/opencode.db)
  --server-log <p>  server.log (default: $XDG_STATE_HOME/oclitellmac/server.log)
  -h, --help        Show this help`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    list: { type: "boolean", default: false },
    last: { type: "string" },
    since: { type: "string" },
    model: { type: "string" },
    log: { type: "boolean", default: false },
    format: { type: "string", default: "table" },
    db: { type: "string" },
    "server-log": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
})

if (values.help) {
  console.log(HELP)
  process.exit(0)
}

const dataHome = process.env.XDG_DATA_HOME ?? path.join(homedir(), ".local", "share")
const stateHome = process.env.XDG_STATE_HOME ?? path.join(homedir(), ".local", "state")
const dbPath = values.db ?? path.join(dataHome, "opencode", "opencode.db")
const logPath = values["server-log"] ?? path.join(stateHome, "oclitellmac", "server.log")

const db = new Database(dbPath, { readonly: true })

if (values.list) {
  const rows = db
    .query(
      `select s.id, datetime(s.time_updated/1000,'unixepoch') as updated,
              (select count(*) from session_message m where m.session_id = s.id and m.type = 'assistant') as requests,
              substr(coalesce(s.title, ''), 1, 50) as title
       from session_v2 s order by s.time_updated desc limit 15`,
    )
    .all() as { id: string; updated: string; requests: number; title: string }[]
  console.log(["session", "updated (UTC)", "requests", "title"].join("\t"))
  rows.forEach((row) => console.log([row.id, row.updated, row.requests, row.title].join("\t")))
  process.exit(0)
}

const sessionID =
  positionals[0] ??
  (db.query(`select id from session_v2 order by time_updated desc limit 1`).get() as { id: string } | null)?.id
if (!sessionID) fail("No session found.")

type Row = {
  created: number
  model: string | null
  input: number | null
  read: number | null
  write: number | null
  output: number | null
  reasoning: number | null
  cost: number | null
}

const since = values.since ? Date.parse(values.since.includes("T") || values.since.length > 10 ? values.since : `${values.since}T00:00:00Z`) : undefined
if (values.since && Number.isNaN(since)) fail(`Cannot parse --since "${values.since}".`)

let rows = (
  db
    .query(
      `select time_created as created,
              json_extract(data,'$.model.id') as model,
              json_extract(data,'$.tokens.input') as input,
              json_extract(data,'$.tokens.cache.read') as read,
              json_extract(data,'$.tokens.cache.write') as write,
              json_extract(data,'$.tokens.output') as output,
              json_extract(data,'$.tokens.reasoning') as reasoning,
              json_extract(data,'$.cost') as cost
       from session_message
       where session_id = ? and type = 'assistant'
       order by seq`,
    )
    .all(sessionID) as Row[]
).filter((row) => row.input !== null)

if (rows.length === 0) fail(`No finished assistant requests found for ${sessionID}.`)
if (since !== undefined) rows = rows.filter((row) => row.created >= since)
if (values.model) rows = rows.filter((row) => row.model?.includes(values.model!))
if (values.last) rows = rows.slice(-Number(values.last))
if (rows.length === 0) fail("No requests match the filters.")

type Diagnostic = {
  time: number
  model: string
  cc: number
  system: number
  tools: number
  toolHash: string
  prefixHash: string
  optionsHash: string
  divergence: number | null
}

const diagnostics: Diagnostic[] = values.log ? readDiagnostics(logPath) : []

const header = ["time (UTC)", "model", "input", "cache read", "cache write", "output", "cost", "hit %"]
if (values.log) header.push("breakpoints", "tools", "tool hash", "options hash", "diverges at")

const table = rows.map((row) => {
  const read = row.read ?? 0
  const write = row.write ?? 0
  const input = row.input ?? 0
  const total = read + write + input
  const cells = [
    new Date(row.created).toISOString().slice(0, 19).replace("T", " "),
    row.model ?? "?",
    input,
    read,
    write,
    (row.output ?? 0) + (row.reasoning ?? 0),
    row.cost === null ? "" : row.cost.toFixed(3),
    total === 0 ? "" : ((read / total) * 100).toFixed(1),
  ].map(String)
  if (values.log) {
    // Both timestamps are taken when the request starts (the message row is created
    // with the request, the diagnostics line just before it is sent), so match the
    // closest line of the same model within a few seconds. Requests the plugin does
    // not log (for example title generation) simply find no line.
    const match = diagnostics
      .filter((item) => item.model === row.model && Math.abs(item.time - row.created) < 5_000)
      .sort((a, b) => Math.abs(a.time - row.created) - Math.abs(b.time - row.created))[0]
    cells.push(
      match ? String(match.cc) : "-",
      match ? String(match.tools) : "-",
      match ? match.toolHash.slice(-6) : "-",
      match ? match.optionsHash.slice(-6) : "-",
      match ? (match.divergence === null ? "none" : String(match.divergence)) : "-",
    )
  }
  return cells
})

const totals = rows.reduce(
  (sum, row) => ({
    input: sum.input + (row.input ?? 0),
    read: sum.read + (row.read ?? 0),
    write: sum.write + (row.write ?? 0),
    output: sum.output + (row.output ?? 0) + (row.reasoning ?? 0),
    cost: sum.cost + (row.cost ?? 0),
  }),
  { input: 0, read: 0, write: 0, output: 0, cost: 0 },
)
const totalInput = totals.input + totals.read + totals.write

if (values.format === "markdown") {
  console.log(`| ${header.join(" | ")} |`)
  console.log(`|${header.map(() => "---").join("|")}|`)
  table.forEach((cells) => console.log(`| ${cells.join(" | ")} |`))
} else {
  const widths = header.map((title, column) => Math.max(title.length, ...table.map((cells) => cells[column].length)))
  const line = (cells: string[]) =>
    cells.map((cell, column) => (column <= 1 ? cell.padEnd(widths[column]) : cell.padStart(widths[column]))).join("  ")
  console.log(line(header))
  console.log(widths.map((width) => "-".repeat(width)).join("  "))
  table.forEach((cells) => console.log(line(cells)))
}

console.log(
  `\n${sessionID}: ${rows.length} requests, ${totals.read.toLocaleString("en")} cache-read of ` +
    `${totalInput.toLocaleString("en")} input tokens (${totalInput === 0 ? 0 : ((totals.read / totalInput) * 100).toFixed(1)}%), ` +
    `${totals.write.toLocaleString("en")} written, ${totals.output.toLocaleString("en")} output, cost ${totals.cost.toFixed(2)}`,
)
if (values.log && diagnostics.length === 0)
  console.log("No diagnostics lines found. Enable options.cachePrefixDiagnostics in server.json first.")

function readDiagnostics(file: string): Diagnostic[] {
  const text = Bun.file(file)
  if (!text.size) return []
  return readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line: string): Diagnostic[] => {
      const space = line.indexOf(" ")
      if (space === -1 || !line.includes('"request_id"')) return []
      try {
        const body = JSON.parse(line.slice(space + 1))
        return [
          {
            time: Date.parse(line.slice(0, space)),
            model: body.model,
            cc: body.cache_control_block_count,
            system: body.system_block_count,
            tools: body.tool_count,
            toolHash: body.tool_schema_hash,
            prefixHash: body.stable_prefix_hash,
            optionsHash: body.provider_options_hash,
            divergence: body.first_divergence_index,
          },
        ]
      } catch {
        return []
      }
    })
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
