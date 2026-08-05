/**
 * Field mapping helpers for LiteLLM to OpenCode ModelConfig translation.
 */

type AnyRecord = Record<string, any>;

/**
 * LiteLLM reports `input_cost_per_token` / `output_cost_per_token` (and the
 * cache / extended-context variants) in USD per single token. OpenCode's
 * `cost.input` / `cost.output` ModelConfig fields are USD per **million**
 * tokens — `packages/opencode/src/session/session.ts` divides token counts
 * by this same constant before multiplying by the cost fields. Without this
 * conversion, every displayed/tracked cost would be 1,000,000x too low.
 *
 * See docs/litellm-integration/field-coverage-comparison.md §2a
 * ("Cost unit conversion") for the full rationale.
 */
const USD_PER_TOKEN_TO_PER_MILLION = 1_000_000;

/**
 * Return the first non-null/undefined value from (dict, key) pairs.
 */
function getFirst(...sources: Array<[AnyRecord, string]>): any {
	for (const [d, k] of sources) {
		const v = d[k];
		if (v !== null && v !== undefined) {
			return v;
		}
	}
	return null;
}

/**
 * Map LiteLLM capability flags to flat OpenCode ModelConfig boolean fields.
 *
 * OpenCode ModelConfig fields (packages/core/src/v1/config/provider.ts —
 * see docs/litellm-integration/source-map.md for the exact commit):
 *     tool_call   — supports_function_calling / supports_parallel_function_calling
 *     attachment  — supports_vision (image input)
 *     reasoning   — supports_reasoning
 *     temperature — no LiteLLM source; True for all chat models
 *
 * 'interleaved' is intentionally omitted: there is no reliable LiteLLM
 * source for which provider-specific field name reasoning text should be
 * routed to (see docs/litellm-integration/field-coverage-comparison.md §2a).
 */
export function mapFlags(
	hub: AnyRecord,
	info: AnyRecord,
): Record<string, boolean> {
	const toolCall = Boolean(
		hub.supports_function_calling ||
			hub.supports_parallel_function_calling ||
			info.supports_function_calling,
	);
	const attachment = Boolean(hub.supports_vision || info.supports_vision);
	const reasoning = Boolean(hub.supports_reasoning || info.supports_reasoning);
	return {
		tool_call: toolCall,
		attachment: attachment,
		reasoning: reasoning,
		temperature: true, // all chat-capable models support temperature
	};
}

/**
 * Build modalities.{input,output} arrays from LiteLLM capability flags.
 *
 * Input modalities:
 *     text   — always present for chat models
 *     image  — supports_vision  (hub or info)
 *     audio  — supports_audio_input  (info only)
 *     pdf    — supports_pdf_input    (info only)
 *     video  — no LiteLLM source; omitted
 *
 * Output modalities:
 *     text   — always present
 *     audio  — supports_audio_output (info only)
 *     image/video/pdf — no LiteLLM source; omitted
 */
export function mapModalities(
	hub: AnyRecord,
	info: AnyRecord,
): { input: string[]; output: string[] } {
	const inputs: string[] = ["text"];
	const outputs: string[] = ["text"];

	if (hub.supports_vision || info.supports_vision) {
		inputs.push("image");
	}
	if (info.supports_audio_input) {
		inputs.push("audio");
	}
	if (info.supports_pdf_input) {
		inputs.push("pdf");
	}

	if (info.supports_audio_output) {
		outputs.push("audio");
	}

	return { input: inputs, output: outputs };
}

/**
 * Map LiteLLM cost fields to OpenCode ModelConfig cost struct.
 *
 * OpenCode requires both cost.input and cost.output; if either is missing
 * from both sources, the whole cost block is omitted.
 *
 * Schema (packages/core/src/v1/config/provider.ts — see
 * docs/litellm-integration/source-map.md for the exact commit):
 *     cost.input          number   required
 *     cost.output         number   required
 *     cost.cache_read     number?  optional
 *     cost.cache_write    number?  optional
 *     cost.context_over_200k.input    number   (required inside the sub-struct)
 *     cost.context_over_200k.output   number   (required inside the sub-struct)
 *     cost.context_over_200k.cache_read  number?
 *     cost.context_over_200k.cache_write number?
 *
 * All values are converted from LiteLLM's USD-per-single-token convention
 * to OpenCode's USD-per-million-token convention — see
 * USD_PER_TOKEN_TO_PER_MILLION above and
 * docs/litellm-integration/field-coverage-comparison.md §2a.
 */
export function mapCost(hub: AnyRecord, info: AnyRecord): AnyRecord | null {
	const inputCost = getFirst(
		[info, "input_cost_per_token"],
		[hub, "input_cost_per_token"],
	);
	const outputCost = getFirst(
		[info, "output_cost_per_token"],
		[hub, "output_cost_per_token"],
	);

	if (inputCost === null || outputCost === null) {
		return null;
	}

	const cost: AnyRecord = {
		input: inputCost * USD_PER_TOKEN_TO_PER_MILLION,
		output: outputCost * USD_PER_TOKEN_TO_PER_MILLION,
	};

	// Optional cache costs — only available from /v1/model/info.
	const cacheRead = getFirst(
		[info, "cache_read_input_token_cost"],
		[hub, "cache_read_input_token_cost"],
	);
	const cacheWrite = getFirst(
		[info, "cache_creation_input_token_cost"],
		[hub, "cache_creation_input_token_cost"],
	);
	if (cacheRead !== null) {
		cost.cache_read = cacheRead * USD_PER_TOKEN_TO_PER_MILLION;
	}
	if (cacheWrite !== null) {
		cost.cache_write = cacheWrite * USD_PER_TOKEN_TO_PER_MILLION;
	}

	// Extended context cost tier.
	// LiteLLM uses "above_128k" in /v1/model/info and "above_200k" in
	// /public/model_hub. Check both field names.
	const inputOver = getFirst(
		[info, "input_cost_per_token_above_128k_tokens"],
		[hub, "input_cost_per_token_above_200k_tokens"],
		[hub, "input_cost_per_token_above_128k_tokens"],
	);
	const outputOver = getFirst(
		[info, "output_cost_per_token_above_128k_tokens"],
		[hub, "output_cost_per_token_above_200k_tokens"],
		[hub, "output_cost_per_token_above_128k_tokens"],
	);
	if (inputOver !== null && outputOver !== null) {
		cost.context_over_200k = {
			input: inputOver * USD_PER_TOKEN_TO_PER_MILLION,
			output: outputOver * USD_PER_TOKEN_TO_PER_MILLION,
		};
	}

	return cost;
}

/**
 * Build the OpenCode `variants` map from LiteLLM's reasoning-effort support
 * flags (see `fetch.ts` for how `supports_reasoning_efforts` is derived from
 * `/v1/model/info`'s `supports_<level>_reasoning_effort` boolean fields).
 *
 * Returns `undefined` (rather than an empty object) when no levels are
 * reported, so callers can omit the `variants` key entirely.
 */
export function mapVariants(
	info: AnyRecord,
): Record<string, { reasoningEffort: string }> | undefined {
	const efforts: string[] | undefined = info.supports_reasoning_efforts;
	if (!efforts || efforts.length === 0) {
		return undefined;
	}
	return Object.fromEntries(
		efforts.map((effort) => [effort, { reasoningEffort: effort }]),
	);
}

/**
 * Map LiteLLM token limits to OpenCode ModelConfig limit struct.
 *
 * OpenCode requires both limit.context and limit.output; if either is
 * absent from both sources, the whole limit block is omitted.
 *
 * Schema (packages/core/src/v1/config/provider.ts — see
 * docs/litellm-integration/source-map.md for the exact commit):
 *     limit.context   number   required
 *     limit.input     number?  optional (set to same value as context)
 *     limit.output    number   required
 */
export function mapLimit(hub: AnyRecord, info: AnyRecord): AnyRecord | null {
	const maxContext = getFirst([info, "max_input_tokens"], [hub, "max_input_tokens"]);
	const maxOutput = getFirst(
		[info, "max_output_tokens"],
		[info, "max_tokens"],
		[hub, "max_output_tokens"],
		[hub, "max_tokens"],
	);

	if (maxContext === null || maxOutput === null) {
		return null;
	}

	return {
		context: Number(maxContext),
		input: Number(maxContext),
		output: Number(maxOutput),
	};
}
