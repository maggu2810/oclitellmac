/**
 * Category detection for LiteLLM models.
 *
 * Determines the category (chat, embedding, audio_speech, etc.) for a model
 * based on its API 'mode' field or name heuristics.
 */

// Non-chat categories — models in these categories are blacklisted by
// default. Each can be re-enabled via config flags.
export const NON_CHAT_CATEGORIES = new Set([
	"embedding",
	"audio_speech",
	"transcription",
	"image_generation",
	"video_generation",
	"ocr",
	"ranking",
	"router",
] as const);

export type Category =
	| "chat"
	| "embedding"
	| "audio_speech"
	| "transcription"
	| "image_generation"
	| "video_generation"
	| "ocr"
	| "ranking"
	| "router";

// Human-readable labels used in logs and comments.
export const CATEGORY_LABEL: Record<string, string> = {
	embedding: "embedding",
	audio_speech: "audio speech (TTS)",
	transcription: "audio transcription (STT)",
	image_generation: "image generation",
	video_generation: "video generation",
	ocr: "document / OCR",
	ranking: "reranking",
	router: "router",
};

/**
 * Convert a LiteLLM 'mode' field to a category string.
 *
 * Returns null for chat / unknown so the caller falls back to name
 * heuristics via categorizeModel().
 */
function modeToCategory(mode: string): Category | null {
	const mapping: Record<string, Category> = {
		embedding: "embedding",
		audio_speech: "audio_speech",
		audio_transcription: "transcription",
		image_generation: "image_generation",
		video_generation: "video_generation",
		rerank: "ranking",
		moderations: "router",
	};
	return mapping[mode] ?? null;
}

/**
 * Return the category for a model, preferring the API 'mode' field.
 */
export function categorizeModel(name: string, mode: string = ""): Category {
	const fromMode = modeToCategory(mode);
	if (fromMode) {
		return fromMode;
	}
	const n = name.toLowerCase();
	if (n.includes("embedding")) {
		return "embedding";
	}
	if (n.includes("tts") || n.includes("chirp")) {
		return "audio_speech";
	}
	if (n.includes("transcribe") || n.includes("whisper")) {
		return "transcription";
	}
	if (n.includes("image") || n.includes("dall-e") || n.includes("stable-diffusion")) {
		return "image_generation";
	}
	if (n.includes("veo") || n.includes("video")) {
		return "video_generation";
	}
	if (n.includes("doc-intel") || n.includes("ocr")) {
		return "ocr";
	}
	if (n.includes("ranker") || n.includes("rerank")) {
		return "ranking";
	}
	if (n.includes("router")) {
		return "router";
	}
	return "chat";
}
