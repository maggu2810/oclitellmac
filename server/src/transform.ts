/**
 * Provider transformation — converts LiteLLM API data to OpenCode provider config.
 * 
 * This module orchestrates the pipeline:
 *   - Fetch data (handled by fetch.ts)
 *   - Categorize models (categorize.ts)
 *   - Map fields (map.ts)
 *   - Build entries (build.ts)
 *   - Filter blacklist (filter.ts)
 *   - Transform to OpenCode API format (this module)
 */

import type { ModelHubEntry, ModelInfoEntry } from "./fetch.js";
import { buildModelEntry } from "./build.js";
import { categorizeModel, type Category } from "./categorize.js";

/**
 * Build models map and categories from LiteLLM endpoints.
 * 
 * Returns both the models object (for OpenCode provider config) and
 * a categories map (for blacklist filtering).
 */
export function transformModels(
	hubEntries: ModelHubEntry[],
	infoMap: Record<string, ModelInfoEntry["model_info"]>,
): {
	models: Record<string, any>;
	categories: Map<string, Category>;
} {
	const models: Record<string, any> = {};
	const categories = new Map<string, Category>();

	for (const hubEntry of hubEntries) {
		const modelId = hubEntry.model_group;
		if (!modelId) continue;

		const info = infoMap[modelId] ?? {};
		const category = categorizeModel(modelId, hubEntry.mode ?? "");
		categories.set(modelId, category);

		models[modelId] = buildModelEntry(hubEntry, info, category);
	}

	return { models, categories };
}
