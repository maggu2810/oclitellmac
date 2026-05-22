# TUI Plugin - Technical Reference

**Plugin Type**: TUI (v2 plugin API)  
**Entry Point**: `oclitellmac/tui`

## Overview

The TUI plugin displays budget and usage information from LiteLLM proxies in the OpenCode sidebar. It operates as a **pure consumer** of data written by the server plugin, with zero network overhead.

### Key Responsibilities

1. Read budget files from `~/.local/state/oclitellmac/key-info/`
2. Parse and validate budget data structure
3. Display provider cards in OpenCode sidebar
4. Watch files for changes and update display in real-time
5. Format timestamps, budget amounts, and reset schedules
6. Apply color-coded visual alerts based on usage percentage

### Architecture Pattern

**File-Based Reactive UI**:
- **No API calls** - reads only from local files
- **Event-driven updates** - fs.watch() with polling fallback
- **Signal-based rendering** - Solid.js reactivity
- **Zero network overhead** - instant display updates

## Module Structure

```
plugins/oclitellmac/tui/src/
├── index.tsx              # Plugin entry point, TUI registration
├── paths.ts               # Path management (xdg-basedir wrapper)
├── log.ts                 # File-based logger (independent debugging)
├── types.ts               # TypeScript type definitions
├── loader.ts              # File reading & parsing logic
├── watcher.ts             # File watching (fs.watch + polling fallback)
├── components/
│   ├── KeyInfoPanel.tsx   # Main panel component (container)
│   └── ProviderCard.tsx   # Individual provider card (display)
└── utils/
    └── format.ts          # Formatting utilities (timestamps, currency, etc.)
```

### Module Responsibilities

#### `paths.ts` - Path Management
- Centralized path management using `xdg-basedir` library
- Exports state directory and budget data directory functions
- XDG-compliant on Linux (respects `XDG_STATE_HOME`)
- Uses Unix-style paths on all platforms (consistent with OpenCode core)

**Exported Functions**:
- `getBudgetDataDir()`: Returns `~/.local/state/oclitellmac/key-info`
- `getStateDir()`: Base directory getter with validation
- `getLogDir()`: Returns `~/.local/state/oclitellmac/log` for debug logs

**Platform Behavior**:
- Linux: Respects `XDG_STATE_HOME` environment variable (default: `~/.local/state`)
- macOS/Windows: Uses Unix-style path (`~/.local/state`)

See [PATH-STRATEGY.md](../docs/PATH-STRATEGY.md) for detailed rationale and alternative approaches considered.

#### `index.tsx` - Plugin Entry Point
- Exports default TUI plugin object (implements `TuiPluginModule`)
- Registers "Key Info" panel with OpenCode sidebar
- Creates file watcher for budget directory
- Loads initial budget data on startup
- Instantiates a file-based logger to write independent debug logs

**Key Responsibilities**:
- Initializes `Logger` from `log.ts` using log path from `paths.ts`
- Initializes `BudgetLoader` and `BudgetWatcher`, passing the logger instance
- Manages reactive state (`budgetData`, `loadStatus`) with Solid.js signals
- Registers sidebar slot for `KeyInfoPanel`
- Handles cleanup and logger disposal on plugin dispose

#### `log.ts` - File-Based Logger
- Independent logger class shared between TUI and server modules
- Writes logs to `<logBaseDirectory>/<id>/YYYY-MM-DD-HH-mm-ss.log`
- Rotates log files every 500 calls by default to prevent large files
- Falls back to `console.error` on write failures or if filesystem is read-only

#### `types.ts` - Type Definitions

Defines core data structures:

**`KeyInfoFile`** - Budget file structure:
```typescript
interface KeyInfoFile {
  providerKey: string           // Unique provider identifier
  providerName?: string         // Display name (optional, from server)
  fetchedAt: number             // Unix timestamp (milliseconds)
  keyInfo: {
    key: string                 // LiteLLM key identifier
    info: {
      key_alias?: string        // Human-readable key name
      spend: number             // Current spend
      max_budget?: number       // Budget limit
      budget_duration?: string  // Reset interval (e.g., "monthly", "7d")
      budget_reset_at?: string  // ISO 8601 timestamp
      expires?: string          // ISO 8601 timestamp
    }
  }
}
```

**`BudgetInfo`** - Normalized display structure:
```typescript
interface BudgetInfo {
  providerKey: string
  providerName: string          // Auto-formatted from providerKey if missing
  spend: number
  maxBudget: number | null
  remaining: number | null
  usagePercent: number | null
  resetAt: string | null
  duration: string | null
  keyAlias: string | null
  fetchedAt: number
}
```

#### `loader.ts` - Data Loading & Parsing

**Key Functions**:
- `BudgetLoader.loadAll()`: Scans directory, reads all budget files
- `BudgetLoader.loadOne(providerKey)`: Reads and parses single file
- `formatProviderName(key)`: Auto-formats provider key (e.g., "litellm-prod" → "LiteLLM Prod")
- `getBudgetDataDir()`: Path getter (delegates to `paths.ts`)

**Data Flow**:
```
1. Scan ~/.local/state/oclitellmac/key-info/ (via paths.getBudgetDataDir())
   ↓
2. Read each *.json file
   ↓
3. Parse and validate structure
   ↓
4. Normalize to ProviderBudget
   ↓
5. Return { budgets, hasErrors, errorCount }
```

**Error Handling**:
- Skips invalid files (logs warning)
- Validates nested structure (`keyInfo.info.*`)
- Provides fallbacks for missing fields
- Returns empty budgets object if directory doesn't exist

#### `watcher.ts` - File Watching

**Key Functions**:
- `BudgetWatcher.start(directory, onChange)`: Starts file watcher
- `BudgetWatcher.stop()`: Cleanup on plugin unmount

**Watch Strategy**:
1. **Primary**: `fs.watch()` for instant updates (~100ms latency)
2. **Fallback**: `setInterval()` polling (5s interval) if watch unavailable

**Event Detection**:
- Triggers on file `change` and `rename` events
- Debounces rapid changes (single callback per batch)
- Watches entire directory, not individual files

**Performance**:
- Zero CPU usage when idle (fs.watch is event-driven)
- Minimal overhead on change (single file read)
- Automatic fallback ensures compatibility

#### `components/KeyInfoPanel.tsx` - Main Panel Component

**Responsibilities**:
- Container for all provider cards
- Display loading/error states
- Pass budget data to individual cards

**States**:
- **Loading**: "Waiting for oclitellmac/server..."
- **Error**: "Budget data parsing error (N files)"
- **Success**: Renders provider cards

**Props**: Receives `budgetInfo: BudgetInfo[]` signal

#### `components/ProviderCard.tsx` - Provider Card Component

**Responsibilities**:
- Display single provider's budget information
- Progress bar visualization
- Color-coded status indicators
- Format timestamps, currency, percentages

**Visual Elements**:
- Provider name (header)
- Progress bar (usage percentage)
- Budget display (`$X / $Y`)
- Percentage used
- Remaining budget
- Reset schedule (e.g., "Resets in 15d (monthly)")
- Fetch timestamp (absolute, timezone-aware)

**Color Coding**:
- 🟢 Green (< 75% used) - Healthy
- 🟡 Yellow (75-90% used) - Warning
- 🔴 Red (> 90% used) - Danger

**Props**: Receives single `BudgetInfo` object

#### `utils/format.ts` - Formatting Utilities

**Key Functions**:

- `formatAbsoluteTimeLocale(timestamp)`: Absolute timestamp with locale
  - Example: "5/11/2026, 2:45:23 PM"
  - Uses `Intl.DateTimeFormat` for timezone awareness

- `formatAbsoluteTimeISO(timestamp)`: ISO-style timestamp
  - Example: "2026-05-11 14:45:23"
  - Alternative format (not currently used)

- `formatRelativeTime(timestamp)`: Relative time
  - Example: "2 minutes ago", "3 hours ago"
  - Used for reset schedules

- `formatSmartTime(timestamp)`: Smart format (relative if recent, absolute if old)
  - Not currently used (kept for compatibility)

- `formatCurrency(amount)`: Currency formatting
  - Example: "$45.67"
  - Always 2 decimal places

- `formatPercentage(value)`: Percentage formatting
  - Example: "45.7%"
  - 1 decimal place

**Design Choice**: Absolute timestamps selected for accuracy (no periodic UI refresh needed)

## Data Flow

### Startup Flow

```
1. TUI plugin loads (on OpenCode TUI startup)
   ↓
2. Check if ~/.local/state/oclitellmac/key-info/ exists
   ↓
3. If exists:
   a. BudgetLoader.loadAll()
   b. Parse all *.json files
   c. Normalize to BudgetInfo[]
   d. Update budgetInfo signal
   ↓
4. Start file watcher:
   a. fs.watch(directory, onChange)
   b. Fallback to setInterval(5s) if watch fails
   ↓
5. Render KeyInfoPanel with initial data
```

### Update Flow (File Change)

```
1. Server plugin writes new budget file
   ↓
2. fs.watch() detects change event
   ↓
3. onChange() callback fires (~100ms latency)
   ↓
4. BudgetLoader.loadAll()
   ↓
5. Update budgetInfo signal
   ↓
6. Solid.js reactivity triggers re-render
   ↓
7. User sees updated budget data in sidebar
```

### Error Flow

```
1. File read fails or parse error
   ↓
2. Log warning with file path and error
   ↓
3. Skip invalid file (continue with others)
   ↓
4. If all files invalid:
   a. Set error state
   b. Display "Budget data parsing error"
   ↓
5. If directory missing:
   a. Set loading state
   b. Display "Waiting for oclitellmac/server..."
```

## Component Hierarchy

```
<KeyInfoPanel>
  └── For each provider:
      <ProviderCard>
        ├── Provider name
        ├── Progress bar (color-coded)
        ├── Budget display ($X / $Y)
        ├── Percentage (X% used)
        ├── Remaining ($X remaining)
        ├── Reset schedule (Resets in Xd/h)
        └── Fetch timestamp (Fetched X)
      </ProviderCard>
</KeyInfoPanel>
```

## Signal Management

Uses Solid.js signals for reactivity:

```typescript
const [budgetInfo, setBudgetInfo] = createSignal<BudgetInfo[]>([])
const [loadAttempted, setLoadAttempted] = createSignal(false)

// Update signal when files change
watcher.start(directory, () => {
  const data = BudgetLoader.loadAll(directory)
  setBudgetInfo(data)
  setLoadAttempted(true)
})
```

**Benefits**:
- Automatic re-rendering on signal updates
- Fine-grained reactivity (only affected components update)
- No manual DOM manipulation needed

## File Watching Implementation

### Primary: fs.watch()

```typescript
import fs from 'fs'

const watcher = fs.watch(directory, (eventType, filename) => {
  if (eventType === 'change' || eventType === 'rename') {
    onChange() // Trigger reload
  }
})
```

**Advantages**:
- Instant updates (~100ms)
- Zero CPU when idle
- Platform-native implementation

**Limitations**:
- Not available on all platforms
- May miss rapid changes
- Requires fallback strategy

### Fallback: setInterval()

```typescript
const pollInterval = setInterval(() => {
  onChange() // Periodic reload
}, 5000) // 5 seconds
```

**Advantages**:
- Works everywhere
- Guaranteed updates
- Simple implementation

**Disadvantages**:
- 5s delay for updates
- Constant polling overhead
- More CPU usage

### Hybrid Strategy

1. Try `fs.watch()` first
2. If unavailable/fails, fall back to `setInterval()`
3. Always cleanup on plugin unmount

## Performance Characteristics

### Memory
- **< 5 MB** total overhead
- Budget data cached in-memory (< 100 KB typically)
- Minimal Solid.js runtime overhead

### CPU
- **Near zero when idle** (fs.watch is event-driven)
- Brief spike on file change (< 50ms to parse and render)
- Polling fallback: ~1% CPU (5s interval)

### Disk I/O
- **Reads only on change** (not continuous polling)
- Typical file size: 1-5 KB per provider
- No writes (TUI is read-only)

### Network
- **Zero network calls** - purely file-based
- No API dependencies
- No external requests

## Error Handling

### Invalid File Format

```typescript
try {
  const content = await readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as KeyInfoFile
  if (
    !data.keyInfo?.info ||
    typeof data.keyInfo.info.spend !== 'number' ||
    typeof data.keyInfo.info.max_budget !== 'number'
  ) {
    this.logger.log('error', `Invalid budget data for ${data.providerKey}: missing or invalid keyInfo.info fields`)
    return null
  }
  // Transform and return
} catch (error) {
  return null // Skip this file
}
```

### Missing Directory

```typescript
try {
  const files = await readdir(this.budgetDataDir)
  // ...
} catch (error) {
  // Directory doesn't exist yet or is inaccessible
  this.logger.log('info', 'Budget directory not found - waiting for server plugin')
}
```

### File Watch Failure

```typescript
try {
  this.watcher = watch(keyInfoDir, { recursive: false }, (eventType, filename) => {
    // ...
  })
} catch (error) {
  this.logger.log('warn', `watcher.start: fs.watch failed, starting polling fallback: ${error}`)
  this.startPolling()
}
```

## Provider Name Resolution

The TUI plugin resolves provider names with this priority:

1. **`providerName` from file** (if server plugin wrote it)
2. **Auto-formatted from `providerKey`**:
   - Split on `-` or `_`
   - Capitalize each word
   - Join with space
   - Example: `"litellm-prod"` → `"Litellm Prod"`

```typescript
function formatProviderName(providerKey: string): string {
  return providerKey
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
```

## Timestamp Display Strategy

### Decision: Absolute Timestamps

**Chosen Format**: `"5/11/2026, 2:45:23 PM"` (locale-aware)

**Rationale**:
- ✅ Always accurate (no periodic refresh needed)
- ✅ Respects user timezone
- ✅ Includes seconds for precision
- ✅ Clear "when was this fetched?" information

**Alternative Considered**: Relative time ("2 minutes ago")
- ❌ Requires periodic UI refresh (every 1s)
- ❌ Loses precision over time ("3 hours ago" → ambiguous)
- ❌ Additional CPU overhead

**Implementation**:
```typescript
new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: true
}).format(new Date(timestamp))
```

## Compatibility

- OpenCode v2 plugin API (TUI plugins)
- Solid.js (provided by OpenCode runtime)
- Node.js 18+ (fs.watch, Intl APIs)
- Platform: Linux, macOS, Windows (file watching may vary)

## Related Documentation

- **User Guide**: See [README.md](../README.md) for installation and configuration
- **Server Plugin**: See [server/README.md](../server/README.md) for budget file format and generation
