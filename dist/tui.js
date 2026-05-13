// tui/src/index.tsx
import { createComponent as _$createComponent2 } from "@opentui/solid";
import { createSignal } from "solid-js";

// tui/src/loader.ts
import { readdir, readFile } from "fs/promises";
import path2 from "path";

// tui/src/paths.ts
import { xdgState } from "xdg-basedir";
import path from "path";
var stateHome = xdgState ? path.join(xdgState, "oclitellmac") : undefined;
function getStateDir() {
  if (!stateHome) {
    throw new Error("XDG_STATE_HOME is not set and home directory could not be determined");
  }
  return stateHome;
}
function getBudgetDataDir() {
  return path.join(getStateDir(), "key-info");
}
function getLogDir() {
  return path.join(getStateDir(), "log");
}

// tui/src/loader.ts
class BudgetLoader {
  budgetDataDir;
  logger;
  constructor(logger) {
    this.logger = logger;
    this.budgetDataDir = getBudgetDataDir();
  }
  getBudgetDataDir() {
    return this.budgetDataDir;
  }
  async loadAll() {
    this.logger.log("info", `loadAll: starting, budgetDataDir=${this.budgetDataDir}`);
    const budgets = {};
    let errorCount = 0;
    try {
      const files = await readdir(this.budgetDataDir);
      this.logger.log("info", `loadAll: found ${files.length} files`);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      for (const file of jsonFiles) {
        const providerKey = file.replace(".json", "");
        const budget = await this.loadOne(providerKey);
        if (budget) {
          budgets[providerKey] = budget;
          this.logger.log("info", `loadAll: loaded budget for ${providerKey}`);
        } else {
          errorCount++;
          this.logger.log("warn", `Failed to parse budget data for ${providerKey}`);
        }
      }
    } catch (error) {
      this.logger.log("info", "Budget directory not found - waiting for server plugin");
    }
    return {
      budgets,
      hasErrors: errorCount > 0,
      errorCount
    };
  }
  async loadOne(providerKey) {
    const filePath = path2.join(this.budgetDataDir, `${providerKey}.json`);
    try {
      const content = await readFile(filePath, "utf-8");
      const data = JSON.parse(content);
      if (!data.keyInfo?.info || typeof data.keyInfo.info.spend !== "number" || typeof data.keyInfo.info.max_budget !== "number") {
        this.logger.log("error", `Invalid budget data for ${data.providerKey}: missing or invalid keyInfo.info fields`);
        return null;
      }
      return {
        providerKey: data.providerKey,
        providerName: data.providerName ?? this.formatProviderName(data.providerKey),
        keyAlias: data.keyInfo.info.key_alias || "Unknown",
        spend: data.keyInfo.info.spend,
        limit: data.keyInfo.info.max_budget,
        remaining: data.keyInfo.info.max_budget - data.keyInfo.info.spend,
        percentUsed: data.keyInfo.info.spend / data.keyInfo.info.max_budget * 100,
        duration: data.keyInfo.info.budget_duration || "Unknown",
        resetAt: data.keyInfo.info.budget_reset_at || "Unknown",
        expiresAt: data.keyInfo.info.expires || "Never",
        lastFetched: data.fetchedAt
      };
    } catch (error) {
      return null;
    }
  }
  formatProviderName(key) {
    return key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
}

// tui/src/watcher.ts
import { watch } from "fs";
import path3 from "path";

class BudgetWatcher {
  stateDir;
  onChange;
  logger;
  pollInterval;
  watcher = null;
  pollTimer = null;
  constructor(stateDir, onChange, logger, pollInterval = 5000) {
    this.stateDir = stateDir;
    this.onChange = onChange;
    this.logger = logger;
    this.pollInterval = pollInterval;
  }
  start() {
    this.logger.log("info", `watcher.start: stateDir=${this.stateDir}`);
    const keyInfoDir = path3.join(this.stateDir, "key-info");
    try {
      this.watcher = watch(keyInfoDir, { recursive: false }, (eventType, filename) => {
        if (filename && filename.endsWith(".json")) {
          this.logger.log("info", `watcher.onChange: eventType=${eventType}, filename=${filename}`);
          this.onChange();
        }
      });
      this.logger.log("info", "watcher.start: fs.watch started successfully");
    } catch (error) {
      this.logger.log("warn", `watcher.start: fs.watch failed, starting polling fallback: ${error}`);
      this.startPolling();
    }
  }
  startPolling() {
    this.logger.log("info", `watcher.startPolling: interval=${this.pollInterval}ms`);
    this.pollTimer = setInterval(() => {
      this.onChange();
    }, this.pollInterval);
  }
  stop() {
    this.logger.log("info", "watcher.stop");
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

// tui/src/components/KeyInfoPanel.tsx
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect2 } from "@opentui/solid";
import { insert as _$insert2 } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { createTextNode as _$createTextNode2 } from "@opentui/solid";
import { insertNode as _$insertNode2 } from "@opentui/solid";
import { setProp as _$setProp2 } from "@opentui/solid";
import { createElement as _$createElement2 } from "@opentui/solid";
import { Show, For } from "solid-js";

// tui/src/components/ProviderCard.tsx
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";

// tui/src/utils/format.ts
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
function formatPercent(value, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}
function formatProgressBar(value, max, width = 20) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const percent = Math.min(1, safeValue / safeMax);
  const filled = Math.round(percent * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}
function formatRelativeTime(isoString) {
  try {
    const date = typeof isoString === "number" ? new Date(isoString) : new Date(isoString);
    const now = Date.now();
    const diff = date.getTime() - now;
    const absDiff = Math.abs(diff);
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const future = diff > 0;
    if (days > 0) {
      return future ? `in ${days}d` : `${days}d ago`;
    } else if (hours > 0) {
      return future ? `in ${hours}h` : `${hours}h ago`;
    } else if (minutes > 0) {
      return future ? `in ${minutes}m` : `${minutes}m ago`;
    } else {
      return future ? "soon" : "just now";
    }
  } catch {
    return "unknown";
  }
}
function formatAbsoluteTimeLocale(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  } catch {
    return "unknown";
  }
}

// tui/src/components/ProviderCard.tsx
function ProviderCard(props) {
  const {
    budget
  } = props;
  const theme = () => props.theme;
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("text"), _el$3 = _$createElement("b"), _el$4 = _$createElement("text"), _el$5 = _$createElement("text"), _el$6 = _$createTextNode(` / `), _el$7 = _$createElement("text"), _el$8 = _$createTextNode(` used`), _el$9 = _$createElement("text"), _el$0 = _$createTextNode(` remaining`), _el$1 = _$createElement("text"), _el$10 = _$createTextNode(`Resets `), _el$11 = _$createTextNode(` (`), _el$12 = _$createTextNode(`)`), _el$13 = _$createElement("text"), _el$14 = _$createTextNode(`Fetched `);
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$4);
    _$insertNode(_el$, _el$5);
    _$insertNode(_el$, _el$7);
    _$insertNode(_el$, _el$9);
    _$insertNode(_el$, _el$1);
    _$insertNode(_el$, _el$13);
    _$setProp(_el$, "flexDirection", "column");
    _$setProp(_el$, "gap", 0);
    _$setProp(_el$, "padding", 1);
    _$setProp(_el$, "marginBottom", 1);
    _$setProp(_el$, "borderStyle", "rounded");
    _$insertNode(_el$2, _el$3);
    _$insert(_el$3, () => budget.providerName);
    _$insert(_el$4, () => formatProgressBar(budget.spend, budget.limit));
    _$insertNode(_el$5, _el$6);
    _$insert(_el$5, () => formatCurrency(budget.spend), _el$6);
    _$insert(_el$5, () => formatCurrency(budget.limit), null);
    _$insertNode(_el$7, _el$8);
    _$insert(_el$7, () => formatPercent(budget.percentUsed), _el$8);
    _$insertNode(_el$9, _el$0);
    _$insert(_el$9, () => formatCurrency(budget.remaining), _el$0);
    _$insertNode(_el$1, _el$10);
    _$insertNode(_el$1, _el$11);
    _$insertNode(_el$1, _el$12);
    _$insert(_el$1, () => formatRelativeTime(budget.resetAt), _el$11);
    _$insert(_el$1, () => budget.duration, _el$12);
    _$insertNode(_el$13, _el$14);
    _$insert(_el$13, () => formatAbsoluteTimeLocale(budget.lastFetched), null);
    _$effect((_p$) => {
      var _v$ = theme().border, _v$2 = theme().text, _v$3 = percentColor(budget.percentUsed, theme), _v$4 = theme().textMuted, _v$5 = percentColor(budget.percentUsed, theme), _v$6 = theme().textMuted, _v$7 = theme().textMuted, _v$8 = theme().textMuted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$, "borderColor", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$2, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp(_el$4, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp(_el$5, "fg", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp(_el$7, "fg", _v$5, _p$.i));
      _v$6 !== _p$.n && (_p$.n = _$setProp(_el$9, "fg", _v$6, _p$.n));
      _v$7 !== _p$.s && (_p$.s = _$setProp(_el$1, "fg", _v$7, _p$.s));
      _v$8 !== _p$.h && (_p$.h = _$setProp(_el$13, "fg", _v$8, _p$.h));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined,
      h: undefined
    });
    return _el$;
  })();
}
function percentColor(percent, theme) {
  const t = theme();
  if (percent >= 90)
    return t.error;
  if (percent >= 75)
    return t.warning;
  return t.success;
}

// tui/src/components/KeyInfoPanel.tsx
function KeyInfoPanel(props) {
  const theme = () => props.api.theme.current;
  const budgets = () => Object.values(props.budgetData);
  return (() => {
    var _el$ = _$createElement2("box"), _el$2 = _$createElement2("text"), _el$3 = _$createElement2("b");
    _$insertNode2(_el$, _el$2);
    _$setProp2(_el$, "flexDirection", "column");
    _$setProp2(_el$, "gap", 1);
    _$insertNode2(_el$2, _el$3);
    _$insertNode2(_el$3, _$createTextNode2(`Key Info`));
    _$insert2(_el$, _$createComponent(Show, {
      get when() {
        return budgets().length === 0;
      },
      get children() {
        return [_$createComponent(Show, {
          get when() {
            return props.loadStatus.hasErrors;
          },
          get children() {
            return [(() => {
              var _el$5 = _$createElement2("text"), _el$6 = _$createTextNode2(`Budget data parsing error (`), _el$7 = _$createTextNode2(` file`), _el$8 = _$createTextNode2(`)`);
              _$insertNode2(_el$5, _el$6);
              _$insertNode2(_el$5, _el$7);
              _$insertNode2(_el$5, _el$8);
              _$insert2(_el$5, () => props.loadStatus.errorCount, _el$7);
              _$insert2(_el$5, () => props.loadStatus.errorCount !== 1 ? "s" : "", _el$8);
              _$effect2((_$p) => _$setProp2(_el$5, "fg", theme().textMuted, _$p));
              return _el$5;
            })(), (() => {
              var _el$9 = _$createElement2("text");
              _$insertNode2(_el$9, _$createTextNode2(`Check logs for details`));
              _$effect2((_$p) => _$setProp2(_el$9, "fg", theme().textMuted, _$p));
              return _el$9;
            })()];
          }
        }), _$createComponent(Show, {
          get when() {
            return !props.loadStatus.hasErrors;
          },
          get children() {
            return [(() => {
              var _el$1 = _$createElement2("text");
              _$insertNode2(_el$1, _$createTextNode2(`No budget data available`));
              _$effect2((_$p) => _$setProp2(_el$1, "fg", theme().textMuted, _$p));
              return _el$1;
            })(), (() => {
              var _el$11 = _$createElement2("text");
              _$insertNode2(_el$11, _$createTextNode2(`Waiting for oclitellmac-server...`));
              _$effect2((_$p) => _$setProp2(_el$11, "fg", theme().textMuted, _$p));
              return _el$11;
            })()];
          }
        })];
      }
    }), null);
    _$insert2(_el$, _$createComponent(For, {
      get each() {
        return budgets();
      },
      children: (budget) => _$createComponent(ProviderCard, {
        budget,
        get theme() {
          return theme();
        }
      })
    }), null);
    _$effect2((_$p) => _$setProp2(_el$2, "fg", theme().text, _$p));
    return _el$;
  })();
}

// tui/src/log.ts
import fs from "fs";
import path4 from "path";

class Logger {
  fd = null;
  count = 0;
  logDir;
  rotateEvery;
  constructor(logBaseDirectory, id, rotateEvery = 500) {
    if (!id) {
      throw new Error("Logger id must not be empty");
    }
    this.logDir = path4.join(logBaseDirectory, id);
    this.rotateEvery = rotateEvery;
  }
  log(level, message) {
    if (this.count % this.rotateEvery === 0) {
      this.rotate();
    }
    this.write(level, message);
    this.count++;
  }
  close() {
    this.write("info", "logger closing");
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {}
      this.fd = null;
    }
  }
  rotate() {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {}
      this.fd = null;
    }
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      const timestamp = new Date().toISOString().replace("T", "-").replace(/:/g, "-").slice(0, 19);
      const filename = `${timestamp}.log`;
      this.fd = fs.openSync(path4.join(this.logDir, filename), "a");
    } catch (err) {
      console.error("[oclitellmac] failed to open log file", err);
    }
  }
  write(level, message) {
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}
`;
    if (this.fd !== null) {
      try {
        fs.writeSync(this.fd, line);
        return;
      } catch {}
    }
    console.error("[oclitellmac]", line.trimEnd());
  }
}

// tui/src/index.tsx
var PLUGIN_ID = "oclitellmac.tui";
var SIDEBAR_ORDER = 125;
var POLL_INTERVAL_MS = 5000;
var tui = async (api) => {
  const logger = new Logger(getLogDir(), "tui");
  logger.log("info", "=== TUI plugin entry ===");
  const loader = new BudgetLoader(logger);
  const [budgetData, setBudgetData] = createSignal({});
  const [loadStatus, setLoadStatus] = createSignal({
    hasErrors: false,
    errorCount: 0
  });
  async function refreshBudgets() {
    const result = await loader.loadAll();
    setBudgetData(result.budgets);
    setLoadStatus({
      hasErrors: result.hasErrors,
      errorCount: result.errorCount
    });
  }
  logger.log("info", "calling refreshBudgets()");
  await refreshBudgets();
  logger.log("info", `refreshBudgets() complete, loaded ${Object.keys(budgetData()).length} budgets`);
  const watcher = new BudgetWatcher(getStateDir(), () => {
    refreshBudgets().catch((error) => {
      logger.log("error", `Failed to refresh budgets: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, logger, POLL_INTERVAL_MS);
  logger.log("info", "starting watcher");
  watcher.start();
  logger.log("info", "watcher started");
  let sidebarRendered = false;
  logger.log("info", `registering sidebar slot, order=${SIDEBAR_ORDER}`);
  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        if (!sidebarRendered) {
          logger.log("info", `sidebar_content: first render, session_id=${props.session_id}`);
          sidebarRendered = true;
        }
        return _$createComponent2(KeyInfoPanel, {
          api,
          get sessionId() {
            return props.session_id;
          },
          get budgetData() {
            return budgetData();
          },
          get loadStatus() {
            return loadStatus();
          }
        });
      }
    }
  });
  logger.log("info", "sidebar slot registered");
  api.lifecycle.onDispose(() => {
    watcher.stop();
    logger.close();
  });
};
var plugin = {
  id: PLUGIN_ID,
  tui
};
var src_default = plugin;
export {
  src_default as default
};
