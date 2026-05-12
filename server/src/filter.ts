/**
 * Blacklist filter for non-chat models.
 */

import type { Category } from "./categorize.js";
import { NON_CHAT_CATEGORIES } from "./categorize.js";

/**
 * Return [model_id, category] pairs for the provider blacklist.
 *
 * Only models whose category is in NON_CHAT_CATEGORIES and is NOT in
 * enabled_categories are included. Entries are grouped by category (in a
 * stable order) so that the JSONC comment per group is meaningful, and
 * sorted by model ID within each group.
 */
export function buildBlacklist(
	categories: Map<string, Category>,
	enabledCategories: Set<Category>,
): Array<[string, Category]> {
	// Stable category ordering for readable output.
	const categoryOrder: Category[] = [
		"embedding",
		"audio_speech",
		"transcription",
		"image_generation",
		"video_generation",
		"ocr",
		"ranking",
		"router",
	];

	// Group disabled non-chat model IDs by category.
	const byCategory: Map<Category, string[]> = new Map();
	for (const cat of categoryOrder) {
		byCategory.set(cat, []);
	}

	for (const [modelId, category] of categories.entries()) {
		if (
			NON_CHAT_CATEGORIES.has(category) &&
			!enabledCategories.has(category)
		) {
			const list = byCategory.get(category);
			if (list) {
				list.push(modelId);
			} else {
				// Category exists but wasn't in our initialization - add it
				byCategory.set(category, [modelId]);
			}
		}
	}

	const result: Array<[string, Category]> = [];
	for (const category of categoryOrder) {
		const list = byCategory.get(category) ?? [];
		for (const modelId of list.sort()) {
			result.push([modelId, category]);
		}
	}
	return result;
}
