/** @jsxImportSource @opentui/solid */
import type { Plugin } from '@opencode/plugin/tui'
import { createSignal } from 'solid-js'
import type { BudgetData } from './types'
import { BudgetLoader } from './loader'
import { BudgetWatcher } from './watcher'
import { KeyInfoPanel } from './components/KeyInfoPanel'
import { Logger } from './log'
import { getStateDir, getLogDir } from './paths'

const PLUGIN_ID = 'oclitellmac.tui'
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
async function setup(ctx: Plugin.Context) {
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

  let sidebarRendered = false

  ctx.ui.slot({
    append: 'sidebar.content',
    render: (props) => {
      if (!sidebarRendered) {
        logger.log('info', `sidebar.content: first render, session_id=${props.sessionID}`)
        sidebarRendered = true
      }
      return (
        <KeyInfoPanel
          context={ctx}
          budgetData={budgetData()}
          loadStatus={loadStatus()}
        />
      )
    },
  })

  return () => {
    watcher.stop()
    logger.close()
  }
}

const plugin: Plugin.Definition = {
  id: PLUGIN_ID,
  setup,
}

export default plugin
