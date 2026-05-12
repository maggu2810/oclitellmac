/**
 * Model entry builder for OpenCode ModelConfig.
 */

import type { Category } from "./categorize.js";
import { mapCost, mapFlags, mapLimit, mapModalities } from "./map.js";

type AnyRecord = Record<string, any>;

/**
 * Build the full ModelConfig dict for one model.
 *
 * Only fields with actual data are included; empty / False values are
 * omitted so the config stays minimal and readable.
 */
export function buildModelEntry(
	hub: AnyRecord,
	info: AnyRecord,
	category: Category,
): AnyRecord {
	const modelId: string = hub.model_group;
	const model: AnyRecord = {
		id: modelId,
		name: modelId,
	};

	// Flat capability flags (all optional; omit when False to keep config clean).
	const flags = mapFlags(hub, info);
	for (const [key, value] of Object.entries(flags)) {
		if (value) {
			model[key] = value;
		}
	}

	// Modalities (always populated — at minimum ["text"] for both).
	model.modalities = mapModalities(hub, info);

	// Cost block (omit entirely if input or output cost is unknown).
	const cost = mapCost(hub, info);
	if (cost !== null) {
		model.cost = cost;
	}

	// Limit block (omit entirely if context or output limit is unknown).
	const limit = mapLimit(hub, info);
	if (limit !== null) {
		model.limit = limit;
	}

	return model;
}
