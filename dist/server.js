// @bun
// server/src/config.ts
import { z } from "zod";
import { readFile } from "fs/promises";

// server/src/paths.ts
import { xdgConfig, xdgState, xdgCache } from "xdg-basedir";
import path from "path";
var configHome = xdgConfig ? path.join(xdgConfig, "oclitellmac") : undefined;
var stateHome = xdgState ? path.join(xdgState, "oclitellmac") : undefined;
var cacheHome = xdgCache ? path.join(xdgCache, "oclitellmac") : undefined;
function getStateDir() {
  if (!stateHome) {
    throw new Error("XDG_STATE_HOME is not set and home directory could not be determined");
  }
  return stateHome;
}
function getConfigDir() {
  if (!configHome) {
    throw new Error("XDG_CONFIG_HOME is not set and home directory could not be determined");
  }
  return configHome;
}
function getConfigPath() {
  return path.join(getConfigDir(), "server.json");
}
function getProviderCacheDir() {
  return path.join(getStateDir(), "providers");
}
function getBudgetDataDir() {
  return path.join(getStateDir(), "key-info");
}

// server/src/config.ts
var CategorySchema = z.enum([
  "embedding",
  "audio_speech",
  "transcription",
  "image_generation",
  "video_generation",
  "ocr",
  "ranking",
  "router"
]);
var EndpointConfigSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  providerKey: z.string(),
  providerName: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  enabledCategories: z.array(CategorySchema).optional(),
  enableAllCategories: z.boolean().optional().default(false)
});
var ServerConfigSchema = z.object({
  endpoints: z.array(EndpointConfigSchema),
  options: z.object({
    timeout: z.number().optional().default(30),
    budgetPollInterval: z.number().optional().default(60),
    fallbackToCache: z.boolean().optional().default(true)
  }).optional().default({})
});
async function loadConfig() {
  const configPath = getConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const data = JSON.parse(content);
    return ServerConfigSchema.parse(data);
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// server/src/fetch.ts
class LiteLLMClient {
  baseUrl;
  apiKey;
  timeout;
  constructor(baseUrl, apiKey, timeout = 30) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.timeout = timeout;
  }
  normalizeBaseUrl() {
    return this.baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  }
  async fetchModelHub() {
    const url = `${this.normalizeBaseUrl()}/public/model_hub`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout * 1000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch model hub from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async fetchModelInfo() {
    const url = `${this.normalizeBaseUrl()}/v1/model/info`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(Math.max(this.timeout, 60) * 1000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const result = {};
      for (const item of data.data || []) {
        const key = item.key || item.model_name;
        if (key) {
          result[key] = item.model_info || {};
        }
      }
      return result;
    } catch (error) {
      throw new Error(`Failed to fetch model info from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async fetchKeyInfo() {
    const url = `${this.normalizeBaseUrl()}/key/info`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(this.timeout * 1000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch key info from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// server/src/map.ts
function getFirst(...sources) {
  for (const [d, k] of sources) {
    const v = d[k];
    if (v !== null && v !== undefined) {
      return v;
    }
  }
  return null;
}
function mapFlags(hub, info) {
  const toolCall = Boolean(hub.supports_function_calling || hub.supports_parallel_function_calling || info.supports_function_calling);
  const attachment = Boolean(hub.supports_vision || info.supports_vision);
  const reasoning = Boolean(hub.supports_reasoning || info.supports_reasoning);
  return {
    tool_call: toolCall,
    attachment,
    reasoning,
    temperature: true
  };
}
function mapModalities(hub, info) {
  const inputs = ["text"];
  const outputs = ["text"];
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
function mapCost(hub, info) {
  const inputCost = getFirst([info, "input_cost_per_token"], [hub, "input_cost_per_token"]);
  const outputCost = getFirst([info, "output_cost_per_token"], [hub, "output_cost_per_token"]);
  if (inputCost === null || outputCost === null) {
    return null;
  }
  const cost = {
    input: inputCost,
    output: outputCost
  };
  const cacheRead = getFirst([info, "cache_read_input_token_cost"], [hub, "cache_read_input_token_cost"]);
  const cacheWrite = getFirst([info, "cache_creation_input_token_cost"], [hub, "cache_creation_input_token_cost"]);
  if (cacheRead !== null) {
    cost.cache_read = cacheRead;
  }
  if (cacheWrite !== null) {
    cost.cache_write = cacheWrite;
  }
  const inputOver = getFirst([info, "input_cost_per_token_above_128k_tokens"], [hub, "input_cost_per_token_above_200k_tokens"], [hub, "input_cost_per_token_above_128k_tokens"]);
  const outputOver = getFirst([info, "output_cost_per_token_above_128k_tokens"], [hub, "output_cost_per_token_above_200k_tokens"], [hub, "output_cost_per_token_above_128k_tokens"]);
  if (inputOver !== null && outputOver !== null) {
    cost.context_over_200k = {
      input: inputOver,
      output: outputOver
    };
  }
  return cost;
}
function mapLimit(hub, info) {
  const maxContext = getFirst([info, "max_input_tokens"], [hub, "max_input_tokens"]);
  const maxOutput = getFirst([info, "max_output_tokens"], [info, "max_tokens"], [hub, "max_output_tokens"], [hub, "max_tokens"]);
  if (maxContext === null || maxOutput === null) {
    return null;
  }
  return {
    context: Number(maxContext),
    input: Number(maxContext),
    output: Number(maxOutput)
  };
}

// server/src/build.ts
function buildModelEntry(hub, info, category) {
  const modelId = hub.model_group;
  const model = {
    id: modelId,
    name: modelId
  };
  const flags = mapFlags(hub, info);
  for (const [key, value] of Object.entries(flags)) {
    if (value) {
      model[key] = value;
    }
  }
  model.modalities = mapModalities(hub, info);
  const cost = mapCost(hub, info);
  if (cost !== null) {
    model.cost = cost;
  }
  const limit = mapLimit(hub, info);
  if (limit !== null) {
    model.limit = limit;
  }
  return model;
}

// server/src/categorize.ts
var NON_CHAT_CATEGORIES = new Set([
  "embedding",
  "audio_speech",
  "transcription",
  "image_generation",
  "video_generation",
  "ocr",
  "ranking",
  "router"
]);
function modeToCategory(mode) {
  const mapping = {
    embedding: "embedding",
    audio_speech: "audio_speech",
    audio_transcription: "transcription",
    image_generation: "image_generation",
    video_generation: "video_generation",
    rerank: "ranking",
    moderations: "router"
  };
  return mapping[mode] ?? null;
}
function categorizeModel(name, mode = "") {
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

// server/src/transform.ts
function transformModels(hubEntries, infoMap) {
  const models = {};
  const categories = new Map;
  for (const hubEntry of hubEntries) {
    const modelId = hubEntry.model_group;
    if (!modelId)
      continue;
    const info = infoMap[modelId] ?? {};
    const category = categorizeModel(modelId, hubEntry.mode ?? "");
    categories.set(modelId, category);
    models[modelId] = buildModelEntry(hubEntry, info, category);
  }
  return { models, categories };
}

// server/src/filter.ts
function buildBlacklist(categories, enabledCategories) {
  const categoryOrder = [
    "embedding",
    "audio_speech",
    "transcription",
    "image_generation",
    "video_generation",
    "ocr",
    "ranking",
    "router"
  ];
  const byCategory = new Map;
  for (const cat of categoryOrder) {
    byCategory.set(cat, []);
  }
  for (const [modelId, category] of categories.entries()) {
    if (NON_CHAT_CATEGORIES.has(category) && !enabledCategories.has(category)) {
      const list = byCategory.get(category);
      if (list) {
        list.push(modelId);
      } else {
        byCategory.set(category, [modelId]);
      }
    }
  }
  const result = [];
  for (const category of categoryOrder) {
    const list = byCategory.get(category) ?? [];
    for (const modelId of list.sort()) {
      result.push([modelId, category]);
    }
  }
  return result;
}

// server/src/state.ts
import { mkdir, readFile as readFile2, writeFile } from "fs/promises";
import path2 from "path";
class StateManager {
  providerCacheDir;
  budgetDataDir;
  locks = new Map;
  constructor() {
    this.providerCacheDir = getProviderCacheDir();
    this.budgetDataDir = getBudgetDataDir();
  }
  async ensureDirectories() {
    await mkdir(this.providerCacheDir, { recursive: true });
    await mkdir(this.budgetDataDir, { recursive: true });
  }
  async withLock(lockKey, fn) {
    while (this.locks.has(lockKey)) {
      await this.locks.get(lockKey);
    }
    let resolveLock;
    const lockPromise = new Promise((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(lockKey, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(lockKey);
      resolveLock();
    }
  }
  async saveProviderCache(providerKey, data) {
    return this.withLock(`provider:${providerKey}`, async () => {
      const filePath = path2.join(this.providerCacheDir, `${providerKey}.json`);
      const content = JSON.stringify(data, null, 2);
      await writeFile(filePath, content, "utf-8");
    });
  }
  async loadProviderCache(providerKey) {
    const filePath = path2.join(this.providerCacheDir, `${providerKey}.json`);
    try {
      const content = await readFile2(filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  async saveBudgetData(providerKey, data) {
    return this.withLock(`budget:${providerKey}`, async () => {
      const filePath = path2.join(this.budgetDataDir, `${providerKey}.json`);
      const content = JSON.stringify(data, null, 2);
      await writeFile(filePath, content, "utf-8");
    });
  }
  async loadBudgetData(providerKey) {
    const filePath = path2.join(this.budgetDataDir, `${providerKey}.json`);
    try {
      const content = await readFile2(filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  getProviderCacheDir() {
    return this.providerCacheDir;
  }
  getBudgetDataDir() {
    return this.budgetDataDir;
  }
}

// server/src/budget.ts
class BudgetTracker {
  stateManager;
  pollInterval;
  log;
  intervals = new Map;
  providerNames = new Map;
  constructor(stateManager, pollInterval, log) {
    this.stateManager = stateManager;
    this.pollInterval = pollInterval;
    this.log = log;
  }
  async fetchAndStore(providerKey, providerName, client) {
    try {
      const keyInfo = await client.fetchKeyInfo();
      await this.stateManager.saveBudgetData(providerKey, {
        providerKey,
        providerName,
        fetchedAt: Date.now(),
        keyInfo
      });
      this.log(`Budget data updated for ${providerKey}`);
    } catch (error) {
      this.log(`Failed to fetch budget for ${providerKey}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  startTracking(providerKey, providerName, client) {
    if (this.intervals.has(providerKey)) {
      this.log(`Budget tracking already active for ${providerKey}`);
      return;
    }
    this.providerNames.set(providerKey, providerName);
    this.fetchAndStore(providerKey, providerName, client).catch(() => {});
    const interval = setInterval(() => {
      const name = this.providerNames.get(providerKey) ?? providerKey;
      this.fetchAndStore(providerKey, name, client).catch(() => {});
    }, this.pollInterval * 1000);
    this.intervals.set(providerKey, interval);
    this.log(`Started budget tracking for ${providerKey} (interval: ${this.pollInterval}s)`);
  }
  stopTracking(providerKey) {
    const interval = this.intervals.get(providerKey);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(providerKey);
      this.log(`Stopped budget tracking for ${providerKey}`);
    }
  }
  stopAll() {
    for (const [key] of this.intervals) {
      this.stopTracking(key);
    }
  }
}

// server/src/index.ts
function formatProviderName(key) {
  return key.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
async function plugin(input) {
  const log = (message) => {
    input.client.app.log({
      body: {
        service: "oclitellmac-server",
        level: "info",
        message
      }
    }).catch(() => {});
  };
  const stateManager = new StateManager;
  await stateManager.ensureDirectories();
  let config;
  try {
    config = await loadConfig();
    log(`Loaded configuration from ${getConfigPath()}`);
  } catch (error) {
    log(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
    log(`Please create ${getConfigPath()} with your LiteLLM endpoint configuration`);
    return {};
  }
  const { budgetPollInterval, fallbackToCache, timeout } = config.options;
  const budgetTracker = new BudgetTracker(stateManager, budgetPollInterval, log);
  const clientMap = new Map;
  const providerNamesMap = new Map;
  return {
    config: async (opcodeConfig) => {
      log("Config hook: Injecting providers...");
      opcodeConfig.provider ??= {};
      let successCount = 0;
      let cacheCount = 0;
      for (const endpoint of config.endpoints) {
        if (!endpoint.enabled) {
          log(`Skipping disabled endpoint: ${endpoint.providerKey}`);
          continue;
        }
        const client = new LiteLLMClient(endpoint.baseUrl, endpoint.apiKey, timeout);
        clientMap.set(endpoint.providerKey, client);
        let models = {};
        let categories = new Map;
        let usedCache = false;
        try {
          log(`Fetching models for ${endpoint.providerKey} from ${endpoint.baseUrl}...`);
          const [hubEntries, infoMap] = await Promise.all([
            client.fetchModelHub(),
            client.fetchModelInfo()
          ]);
          const result = transformModels(hubEntries, infoMap);
          models = result.models;
          categories = result.categories;
          await stateManager.saveProviderCache(endpoint.providerKey, {
            providerKey: endpoint.providerKey,
            baseUrl: endpoint.baseUrl,
            fetchedAt: Date.now(),
            models,
            categories: Object.fromEntries(categories)
          });
          log(`Loaded ${Object.keys(models).length} models for ${endpoint.providerKey}`);
          successCount++;
        } catch (error) {
          log(`Failed to fetch models for ${endpoint.providerKey}: ${error instanceof Error ? error.message : String(error)}`);
          if (fallbackToCache) {
            const cached = await stateManager.loadProviderCache(endpoint.providerKey);
            if (cached && cached.models) {
              models = cached.models;
              if (cached.categories) {
                categories = new Map(Object.entries(cached.categories));
              }
              usedCache = true;
              cacheCount++;
              log(`Using cached data for ${endpoint.providerKey} (cached at: ${new Date(cached.fetchedAt).toISOString()})`);
            } else {
              log(`No cached data available for ${endpoint.providerKey}`);
              continue;
            }
          } else {
            continue;
          }
        }
        const enabledCategories = new Set;
        if (endpoint.enableAllCategories) {
          enabledCategories.add("embedding");
          enabledCategories.add("audio_speech");
          enabledCategories.add("transcription");
          enabledCategories.add("image_generation");
          enabledCategories.add("video_generation");
          enabledCategories.add("ocr");
          enabledCategories.add("ranking");
          enabledCategories.add("router");
        } else if (endpoint.enabledCategories) {
          endpoint.enabledCategories.forEach((cat) => enabledCategories.add(cat));
        }
        const blacklist = buildBlacklist(categories, enabledCategories);
        const providerConfig = {
          npm: "@ai-sdk/openai-compatible",
          name: endpoint.providerName ?? formatProviderName(endpoint.providerKey),
          key: endpoint.apiKey,
          options: {
            baseURL: `${endpoint.baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "")}/v1`,
            apiKey: endpoint.apiKey,
            litellmProxy: true
          },
          models
        };
        if (blacklist.length > 0) {
          providerConfig.blacklist = blacklist.map(([modelId]) => modelId);
          log(`Blacklisted ${blacklist.length} non-chat models for ${endpoint.providerKey}`);
        }
        opcodeConfig.provider[endpoint.providerKey] = providerConfig;
        const providerName = endpoint.providerName ?? formatProviderName(endpoint.providerKey);
        providerNamesMap.set(endpoint.providerKey, providerName);
        budgetTracker.startTracking(endpoint.providerKey, providerName, client);
      }
      log(`Provider injection complete: ${successCount} fresh, ${cacheCount} cached, ${config.endpoints.length - successCount - cacheCount} failed`);
    },
    "chat.message": async (input2, output) => {
      for (const [providerKey, client] of clientMap) {
        const providerName = providerNamesMap.get(providerKey) ?? formatProviderName(providerKey);
        budgetTracker.fetchAndStore(providerKey, providerName, client).catch(() => {});
      }
    }
  };
}
export {
  plugin as default
};
