/** @jsxImportSource @opentui/solid */
import type { Plugin } from '@opencode/plugin/tui'
import { Show, For } from 'solid-js'
import type { BudgetData } from '../types'
import { ProviderCard } from './ProviderCard'

interface KeyInfoPanelProps {
  context: Plugin.Context
  budgetData: BudgetData
  loadStatus: { hasErrors: boolean; errorCount: number }
}

/**
 * Main Key Info panel component
 * 
 * Displays budget information for all configured LiteLLM providers.
 */
export function KeyInfoPanel(props: KeyInfoPanelProps) {
  const theme = () => props.context.theme
  const budgets = () => Object.values(props.budgetData)

  return (
    <box flexDirection="column" gap={1}>
      {/* Header */}
      <text fg={theme().text.base}>
        <b>Key Info</b>
      </text>

      {/* No data state */}
      <Show when={budgets().length === 0}>
        <Show when={props.loadStatus.hasErrors}>
          <text fg={theme().text.muted}>
            Budget data parsing error ({props.loadStatus.errorCount} file{props.loadStatus.errorCount !== 1 ? 's' : ''})
          </text>
          <text fg={theme().text.muted}>Check logs for details</text>
        </Show>
        <Show when={!props.loadStatus.hasErrors}>
          <text fg={theme().text.muted}>No budget data available</text>
          <text fg={theme().text.muted}>Waiting for oclitellmac-server...</text>
        </Show>
      </Show>

      {/* Provider cards */}
      <For each={budgets()}>
        {(budget) => <ProviderCard budget={budget} theme={theme()} />}
      </For>
    </box>
  )
}
