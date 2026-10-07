import { createHash } from "crypto"

type AnyRecord = Record<string, any>

const hash = (value: unknown) =>
  "sha256:" + createHash("sha256").update(JSON.stringify(value) ?? "").digest("hex").slice(0, 16)

const hasCacheControl = (block: unknown) =>
  typeof block === "object" && block !== null && "cache_control" in block && (block as AnyRecord).cache_control != null

export interface PrefixSummary {
  cache_control_present: boolean
  cache_control_block_count: number
  system_block_count: number
  tool_count: number
  tool_schema_hash: string
  stable_prefix_hash: string
  provider_options_hash: string
  /** One hash per block (tools, system blocks, message blocks); used to locate prefix changes. */
  block_hashes: string[]
}

/**
 * Summarize a request body as counts and hashes only, never content.
 * `stable_prefix_hash` covers every block before the last cache breakpoint, which
 * is the moving conversation tail; a change there between steps breaks cache reuse.
 */
export function summarizeRequest(body: AnyRecord): PrefixSummary {
  const tools: unknown[] = Array.isArray(body.tools) ? body.tools : []
  const system: unknown[] = Array.isArray(body.system) ? body.system : body.system ? [body.system] : []
  const messageBlocks: unknown[] = (Array.isArray(body.messages) ? body.messages : []).flatMap((message: AnyRecord) =>
    Array.isArray(message.content)
      ? message.content.map((block: unknown) => ({ role: message.role, block }))
      : [{ role: message.role, block: message.content }],
  )
  const blocks = [tools, ...system, ...messageBlocks]
  const marks = [
    tools.some(hasCacheControl),
    ...system.map(hasCacheControl),
    ...messageBlocks.map((item) => hasCacheControl((item as AnyRecord).block)),
  ]
  const markerCount =
    tools.filter(hasCacheControl).length + marks.slice(1).filter(Boolean).length
  const lastMarked = marks.lastIndexOf(true)
  const { tools: _t, system: _s, messages: _m, stream: _st, max_tokens: _mt, ...options } = body
  return {
    cache_control_present: markerCount > 0,
    cache_control_block_count: markerCount,
    system_block_count: system.length,
    tool_count: tools.length,
    tool_schema_hash: hash(tools),
    stable_prefix_hash: hash(blocks.slice(0, Math.max(lastMarked, 0)).map(hash)),
    provider_options_hash: hash(options),
    block_hashes: blocks.map(hash),
  }
}

/** Index of the first block that differs from the previous request, or null when it is a pure extension. */
export function firstDivergence(previous: readonly string[], current: readonly string[]): number | null {
  const index = previous.findIndex((value, position) => position < current.length && current[position] !== value)
  if (index !== -1) return index
  return previous.length > current.length ? current.length : null
}
