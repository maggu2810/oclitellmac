/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from '@opencode-ai/plugin/tui'
import { createSignal } from 'solid-js'
import type { BudgetData } from './types'
import { BudgetLoader } from './loader'
import { BudgetWatcher } from './watcher'
import { KeyInfoPanel } from './components/KeyInfoPanel'
import { Logger } from './log'
import { getStateDir, getLogDir } from './paths'

const PLUGIN_ID = 'oclitellmac.tui'
const SIDEBAR_ORDER = 125 // After context (100), before files (500)
const POLL_INTERVAL_MS = 5000 // 5 second fallback polling

/**
 * oclitellmac-tui plugin
 * 
 * Displays LiteLLM budget information in the OpenCode sidebar by reading
 * cached data from ~/.local/state/oclitellmac/key-info/
 * 
 * Uses file watching for real-time updates when oclitellmac-server writes
 * new budget data.
 */
const tui: TuiPlugin = async (api) => {
  // File-based logger for independent debugging
  const logger = new Logger(getLogDir(), 'tui')
  logger.log('info', '=== TUI plugin entry ===')

  const loader = new BudgetLoader(logger)

  // Reactive state
  const [budgetData, setBudgetData] = createSignal<BudgetData>({})
  const [loadStatus, setLoadStatus] = createSignal<{ hasErrors: boolean; errorCount: number }>({ 
    hasErrors: false, 
    errorCount: 0 
  })

  /**
   * Refresh all budget data from files
   */
  async function refreshBudgets() {
    const result = await loader.loadAll()
    setBudgetData(result.budgets)
    setLoadStatus({ hasErrors: result.hasErrors, errorCount: result.errorCount })
  }

  // Initial load
  logger.log('info', 'calling refreshBudgets()')
  await refreshBudgets()
  logger.log('info', `refreshBudgets() complete, loaded ${Object.keys(budgetData()).length} budgets`)

  // Start file watcher for real-time updates
  const watcher = new BudgetWatcher(
    getStateDir(),
    () => {
      // File changed - reload budget data
      refreshBudgets().catch((error) => {
        logger.log('error', `Failed to refresh budgets: ${error instanceof Error ? error.message : String(error)}`)
      })
    },
    logger,
    POLL_INTERVAL_MS,
  )
  logger.log('info', 'starting watcher')
  watcher.start()
  logger.log('info', 'watcher started')

  // Track first render of sidebar_content
  let sidebarRendered = false

  // Register sidebar slot
  logger.log('info', `registering sidebar slot, order=${SIDEBAR_ORDER}`)
  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        // Log first render only to avoid flooding
        if (!sidebarRendered) {
          logger.log('info', `sidebar_content: first render, session_id=${props.session_id}`)
          sidebarRendered = true
        }
        return (
          <KeyInfoPanel 
            api={api} 
            sessionId={props.session_id} 
            budgetData={budgetData()}
            loadStatus={loadStatus()}
          />
        )
      },
    },
  })
  logger.log('info', 'sidebar slot registered')

  // Cleanup on plugin dispose
  api.lifecycle.onDispose(() => {
    watcher.stop()
    logger.close()
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
}

export default plugin
