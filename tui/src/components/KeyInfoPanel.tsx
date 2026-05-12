/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from '@opencode-ai/plugin/tui'
import { Show, For } from 'solid-js'
import type { BudgetData } from '../types'
import { ProviderCard } from './ProviderCard'

interface KeyInfoPanelProps {
  api: TuiPluginApi
  sessionId: string
  budgetData: BudgetData
  loadStatus: { hasErrors: boolean; errorCount: number }
}

/**
 * Main Key Info panel component
 * 
 * Displays budget information for all configured LiteLLM providers.
 */
export function KeyInfoPanel(props: KeyInfoPanelProps) {
  const theme = () => props.api.theme.current
  const budgets = () => Object.values(props.budgetData)

  return (
    <box flexDirection="column" gap={1}>
      {/* Header */}
      <text fg={theme().text}>
        <b>Key Info</b>
      </text>

      {/* No data state */}
      <Show when={budgets().length === 0}>
        <Show when={props.loadStatus.hasErrors}>
          <text fg={theme().textMuted}>
            Budget data parsing error ({props.loadStatus.errorCount} file{props.loadStatus.errorCount !== 1 ? 's' : ''})
          </text>
          <text fg={theme().textMuted}>Check logs for details</text>
        </Show>
        <Show when={!props.loadStatus.hasErrors}>
          <text fg={theme().textMuted}>No budget data available</text>
          <text fg={theme().textMuted}>Waiting for oclitellmac-server...</text>
        </Show>
      </Show>

      {/* Provider cards */}
      <For each={budgets()}>
        {(budget) => <ProviderCard budget={budget} theme={theme()} />}
      </For>
    </box>
  )
}
