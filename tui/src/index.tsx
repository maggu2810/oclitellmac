/** @jsxImportSource @opentui/solid */
import type { Plugin } from '@opencode/plugin/tui'
import { createSignal } from 'solid-js'
import type { BudgetData } from './types'
import { BudgetLoader, type LoadResult } from './loader'
import { BudgetWatcher } from './watcher'
import { Reloader } from './reloader'
import { KeyInfoPanel } from './components/KeyInfoPanel'
import { Logger } from './log'
import { loadTuiSettings } from './config'
import { getStateDir, getLogDir } from './paths'
import { MODE_DESCRIPTIONS, SIDEBAR_MODES, parseMode, type SidebarMode } from './view'

const PLUGIN_ID = 'oclitellmac.tui'
const POLL_INTERVAL_MS = 5000 // 5 second fallback polling

/**
 * oclitellmac-tui plugin
 * 
 * Displays LiteLLM budget information in the OpenCode sidebar by reading
 * cached data from ~/.local/state/oclitellmac/key-info/
 * 
 * Uses file watching for real-time updates when oclitellmac-server writes
 * new budget data. The /budget command switches what the sidebar shows.
 */
async function setup(ctx: Plugin.Context) {
  const settings = loadTuiSettings()
  const logger = new Logger(getLogDir(), 'tui', { level: settings.logLevel })
  logger.log('info', `=== TUI plugin start (logLevel=${settings.logLevel}, sidebarMode=${settings.sidebarMode}) ===`)

  const loader = new BudgetLoader(logger)

  // Reactive state
  const [budgetData, setBudgetData] = createSignal<BudgetData>({})
  const [loadStatus, setLoadStatus] = createSignal<{ hasErrors: boolean; errorCount: number }>({ 
    hasErrors: false, 
    errorCount: 0 
  })

  // Sidebar mode: the stored choice wins over the configured default
  const [sidebar, updateSidebar] = ctx.storage.store('sidebar', {
    initial: { mode: settings.sidebarMode as string },
  })
  const mode = (): SidebarMode => parseMode(sidebar.mode) ?? settings.sidebarMode

  async function setMode(next: SidebarMode) {
    try {
      await updateSidebar((draft) => {
        draft.mode = next
      })
      ctx.ui.toast.show({ variant: 'info', message: `Budget display: ${next}` })
    } catch (error) {
      logger.log('error', `Failed to store sidebar mode: ${error instanceof Error ? error.message : String(error)}`)
      ctx.ui.toast.show({ variant: 'error', message: 'Could not save the budget display mode' })
    }
  }

  ctx.keymap.layer(() => ({
    mode: 'global',
    commands: [
      {
        id: 'oclitellmac.budget',
        title: 'Budget display',
        group: 'Budget',
        slash: { name: 'budget', arguments: true },
        palette: true,
        async run(input) {
          const argument = input?.trim()
          if (argument) {
            const requested = parseMode(argument)
            if (!requested) {
              ctx.ui.toast.show({
                variant: 'error',
                message: `Unknown budget display "${argument}". Use one of: ${SIDEBAR_MODES.join(', ')}`,
              })
              return
            }
            await setMode(requested)
            return
          }
          const chosen = await ctx.ui.dialog.select<SidebarMode>({
            title: 'Budget display',
            options: SIDEBAR_MODES.map((value) => ({
              title: value,
              value,
              description: MODE_DESCRIPTIONS[value],
            })),
            current: mode(),
          })
          if (chosen) await setMode(chosen)
        },
      },
    ],
  }))

  // Serialized reloads; the UI only updates when the loaded content changed
  const reloader = new Reloader<LoadResult>(
    () => loader.loadAll(),
    (result) => {
      setBudgetData(result.budgets)
      setLoadStatus({ hasErrors: result.hasErrors, errorCount: result.errorCount })
    },
    (error) => {
      logger.log('error', `Failed to refresh budgets: ${error instanceof Error ? error.message : String(error)}`)
    },
  )

  await reloader.request()
  logger.log('debug', `initial load complete, ${Object.keys(budgetData()).length} budgets`)

  // Start file watcher for real-time updates
  const watcher = new BudgetWatcher(getStateDir(), () => void reloader.request(), logger, POLL_INTERVAL_MS)
  watcher.start()

  let sidebarRendered = false

  ctx.ui.slot({
    append: 'sidebar.content',
    render: (props) => {
      if (!sidebarRendered) {
        logger.log('debug', `sidebar.content: first render, session_id=${props.sessionID}`)
        sidebarRendered = true
      }
      return (
        <KeyInfoPanel
          context={ctx}
          budgetData={budgetData()}
          loadStatus={loadStatus()}
          mode={mode()}
          providerID={ctx.ui.model.current()?.providerID}
        />
      )
    },
  })

  return () => {
    watcher.stop()
    reloader.stop()
    logger.log('info', '=== TUI plugin stop ===')
    logger.close()
  }
}

const plugin: Plugin.Definition = {
  id: PLUGIN_ID,
  setup,
}

export default plugin
