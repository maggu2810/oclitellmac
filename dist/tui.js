// @bun
// tui/src/index.tsx
import { createComponent as _$createComponent2 } from "@opentui/solid";

// node_modules/solid-js/dist/server.js
var IS_DEV = false;
var equalFn = (a, b) => a === b;
var $PROXY = Symbol("solid-proxy");
var $TRACK = Symbol("solid-track");
var $DEVCOMP = Symbol("solid-dev-component");
var signalOptions = {
  equals: equalFn
};
var ERROR = null;
var runEffects = runQueue;
var STALE = 1;
var PENDING = 2;
var UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
var Transition = null;
var Scheduler = null;
var ExternalSourceConfig = null;
var Listener = null;
var Updates = null;
var Effects = null;
var ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === undefined ? owner : detachedOwner, root = unowned ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: current ? current.context : null,
    owner: current
  }, updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined
  };
  const setter = (value2) => {
    if (typeof value2 === "function") {
      if (Transition && Transition.running && Transition.sources.has(s))
        value2 = value2(s.tValue);
      else
        value2 = value2(s.value);
    }
    return writeSignal(s, value2);
  };
  return [readSignal.bind(s), setter];
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  if (Scheduler && Transition && Transition.running) {
    c.tState = STALE;
    Updates.push(c);
  } else
    updateComputation(c);
  return readSignal.bind(c);
}
function untrack(fn) {
  if (!ExternalSourceConfig && Listener === null)
    return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig)
      return ExternalSourceConfig.untrack(fn);
    return fn();
  } finally {
    Listener = listener;
  }
}
function onCleanup(fn) {
  if (Owner === null)
    ;
  else if (Owner.cleanups === null)
    Owner.cleanups = [fn];
  else
    Owner.cleanups.push(fn);
  return fn;
}
function startTransition(fn) {
  if (Transition && Transition.running) {
    fn();
    return Transition.done;
  }
  const l = Listener;
  const o = Owner;
  return Promise.resolve().then(() => {
    Listener = l;
    Owner = o;
    let t;
    if (Scheduler || SuspenseContext) {
      t = Transition || (Transition = {
        sources: new Set,
        effects: [],
        promises: new Set,
        disposed: new Set,
        queue: new Set,
        running: true
      });
      t.done || (t.done = new Promise((res) => t.resolve = res));
      t.running = true;
    }
    runUpdates(fn, false);
    Listener = Owner = null;
    return t ? t.done : undefined;
  });
}
var [transPending, setTransPending] = /* @__PURE__ */ createSignal(false);
var SuspenseContext;
function readSignal() {
  const runningTransition = Transition && Transition.running;
  if (this.sources && (runningTransition ? this.tState : this.state)) {
    if ((runningTransition ? this.tState : this.state) === STALE)
      updateComputation(this);
    else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  if (runningTransition && Transition.sources.has(this))
    return this.tValue;
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current = Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    if (Transition) {
      const TransitionRunning = Transition.running;
      if (TransitionRunning || !isComp && Transition.sources.has(node)) {
        Transition.sources.add(node);
        node.tValue = value;
      }
      if (!TransitionRunning)
        node.value = value;
    } else
      node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0;i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o))
            continue;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure)
              Updates.push(o);
            else
              Effects.push(o);
            if (o.observers)
              markDownstream(o);
          }
          if (!TransitionRunning)
            o.state = STALE;
          else
            o.tState = STALE;
        }
        if (Updates.length > 1e6) {
          Updates = [];
          if (IS_DEV)
            ;
          throw new Error;
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn)
    return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(node, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value, time);
  if (Transition && !Transition.running && Transition.sources.has(node)) {
    queueMicrotask(() => {
      runUpdates(() => {
        Transition && (Transition.running = true);
        Listener = Owner = node;
        runComputation(node, node.tValue, time);
        Listener = Owner = null;
      }, false);
    });
  }
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner, listener = Listener;
  Listener = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      if (Transition && Transition.running) {
        node.tState = STALE;
        node.tOwned && node.tOwned.forEach(cleanNode);
        node.tOwned = undefined;
      } else {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue, true);
    } else if (Transition && Transition.running && node.pure) {
      if (!Transition.sources.has(node))
        node.value = nextValue;
      Transition.sources.add(node);
      node.tValue = nextValue;
    } else
      node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Transition && Transition.running) {
    c.state = 0;
    c.tState = state;
  }
  if (Owner === null)
    ;
  else if (Owner !== UNOWNED) {
    if (Transition && Transition.running && Owner.pure) {
      if (!Owner.tOwned)
        Owner.tOwned = [c];
      else
        Owner.tOwned.push(c);
    } else {
      if (!Owner.owned)
        Owner.owned = [c];
      else
        Owner.owned.push(c);
    }
  }
  if (ExternalSourceConfig && c.fn) {
    const sourceFn = c.fn;
    const [track, trigger] = createSignal(undefined, {
      equals: false
    });
    const ordinary = ExternalSourceConfig.factory(sourceFn, trigger);
    onCleanup(() => ordinary.dispose());
    let inTransition;
    const triggerInTransition = () => startTransition(trigger).then(() => {
      if (inTransition) {
        inTransition.dispose();
        inTransition = undefined;
      }
    });
    c.fn = (x) => {
      track();
      if (Transition && Transition.running) {
        if (!inTransition)
          inTransition = ExternalSourceConfig.factory(sourceFn, triggerInTransition);
        return inTransition.track(x);
      }
      return ordinary.track(x);
    };
  }
  return c;
}
function runTop(node) {
  const runningTransition = Transition && Transition.running;
  if ((runningTransition ? node.tState : node.state) === 0)
    return;
  if ((runningTransition ? node.tState : node.state) === PENDING)
    return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback))
    return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (runningTransition && Transition.disposed.has(node))
      return;
    if (runningTransition ? node.tState : node.state)
      ancestors.push(node);
  }
  for (let i = ancestors.length - 1;i >= 0; i--) {
    node = ancestors[i];
    if (runningTransition) {
      let top = node, prev = ancestors[i + 1];
      while ((top = top.owner) && top !== prev) {
        if (Transition.disposed.has(top))
          return;
      }
    }
    if ((runningTransition ? node.tState : node.state) === STALE) {
      updateComputation(node);
    } else if ((runningTransition ? node.tState : node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates)
    return fn();
  let wait = false;
  if (!init)
    Updates = [];
  if (Effects)
    wait = true;
  else
    Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait)
      Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    if (Scheduler && Transition && Transition.running)
      scheduleQueue(Updates);
    else
      runQueue(Updates);
    Updates = null;
  }
  if (wait)
    return;
  let res;
  if (Transition) {
    if (!Transition.promises.size && !Transition.queue.size) {
      const sources = Transition.sources;
      const disposed = Transition.disposed;
      Effects.push.apply(Effects, Transition.effects);
      res = Transition.resolve;
      for (const e2 of Effects) {
        "tState" in e2 && (e2.state = e2.tState);
        delete e2.tState;
      }
      Transition = null;
      runUpdates(() => {
        for (const d of disposed)
          cleanNode(d);
        for (const v of sources) {
          v.value = v.tValue;
          if (v.owned) {
            for (let i = 0, len = v.owned.length;i < len; i++)
              cleanNode(v.owned[i]);
          }
          if (v.tOwned)
            v.owned = v.tOwned;
          delete v.tValue;
          delete v.tOwned;
          v.tState = 0;
        }
        setTransPending(false);
      }, false);
    } else if (Transition.running) {
      Transition.running = false;
      Transition.effects.push.apply(Transition.effects, Effects);
      Effects = null;
      setTransPending(true);
      return;
    }
  }
  const e = Effects;
  Effects = null;
  if (e.length)
    runUpdates(() => runEffects(e), false);
  if (res)
    res();
}
function runQueue(queue) {
  for (let i = 0;i < queue.length; i++)
    runTop(queue[i]);
}
function scheduleQueue(queue) {
  for (let i = 0;i < queue.length; i++) {
    const item = queue[i];
    const tasks = Transition.queue;
    if (!tasks.has(item)) {
      tasks.add(item);
      Scheduler(() => {
        tasks.delete(item);
        runUpdates(() => {
          Transition.running = true;
          runTop(item);
        }, false);
        Transition && (Transition.running = false);
      });
    }
  }
}
function lookUpstream(node, ignore) {
  const runningTransition = Transition && Transition.running;
  if (runningTransition)
    node.tState = 0;
  else
    node.state = 0;
  for (let i = 0;i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = runningTransition ? source.tState : source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount))
          runTop(source);
      } else if (state === PENDING)
        lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  const runningTransition = Transition && Transition.running;
  for (let i = 0;i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (runningTransition ? !o.tState : !o.state) {
      if (runningTransition)
        o.tState = PENDING;
      else
        o.state = PENDING;
      if (o.pure)
        Updates.push(o);
      else
        Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(), s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.tOwned) {
    for (i = node.tOwned.length - 1;i >= 0; i--)
      cleanNode(node.tOwned[i]);
    delete node.tOwned;
  }
  if (Transition && Transition.running && node.pure) {
    reset(node, true);
  } else if (node.owned) {
    for (i = node.owned.length - 1;i >= 0; i--)
      cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1;i >= 0; i--)
      node.cleanups[i]();
    node.cleanups = null;
  }
  if (Transition && Transition.running)
    node.tState = 0;
  else
    node.state = 0;
}
function reset(node, top) {
  if (!top) {
    node.tState = 0;
    Transition.disposed.add(node);
  }
  if (node.owned) {
    for (let i = 0;i < node.owned.length; i++)
      reset(node.owned[i]);
  }
}
function castError(err) {
  if (err instanceof Error)
    return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function runErrors(err, fns, owner) {
  try {
    for (const f of fns)
      f(err);
  } catch (e) {
    handleError(e, owner && owner.owner || null);
  }
}
function handleError(err, owner = Owner) {
  const fns = ERROR && owner && owner.context && owner.context[ERROR];
  const error = castError(err);
  if (!fns)
    throw error;
  if (Effects)
    Effects.push({
      fn() {
        runErrors(error, fns, owner);
      },
      state: STALE
    });
  else
    runErrors(error, fns, owner);
}
var FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0;i < d.length; i++)
    d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [], mapped = [], disposers = [], len = 0, indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [], newLen = newItems.length, i, j;
    newItems[$TRACK];
    return untrack(() => {
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot((disposer) => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0;j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen);start < end && items[start] === newItems[start]; start++)
          ;
        for (end = len - 1, newEnd = newLen - 1;end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map;
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd;j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start;i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else
            disposers[i]();
        }
        for (j = start;j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else
            mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
var narrowedError = (name) => `Stale read from <${name}>.`;
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
}
function Show(props) {
  const keyed = props.keyed;
  const conditionValue = createMemo(() => props.when, undefined, undefined);
  const condition = keyed ? conditionValue : createMemo(conditionValue, undefined, {
    equals: (a, b) => !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition))
          throw narrowedError("Show");
        return conditionValue();
      })) : child;
    }
    return props.fallback;
  }, undefined, undefined);
}

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
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
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
