/** @jsxImportSource @opentui/solid */
import type { Plugin } from '@opencode/plugin/tui'
import { Show, For } from 'solid-js'
import type { BudgetData } from '../types'
import { selectBudgets, showsHeader, type SidebarMode } from '../view'
import { ProviderCard } from './ProviderCard'

interface KeyInfoPanelProps {
  context: Plugin.Context
  budgetData: BudgetData
  loadStatus: { hasErrors: boolean; errorCount: number }
  mode: SidebarMode
  /** Provider of the currently selected model */
  providerID: string | undefined
}

/**
 * Main Key Info panel component
 *
 * Displays budget information for the LiteLLM providers selected by the sidebar mode.
 */
export function KeyInfoPanel(props: KeyInfoPanelProps) {
  const theme = () => props.context.theme
  const budgets = () => selectBudgets(props.mode, props.budgetData, props.providerID)

  return (
    <Show
      when={props.mode !== 'hidden'}
      fallback={<text fg={theme().text.muted}>Budget hidden (/budget)</text>}
    >
      <box flexDirection="column" gap={1}>
        {/* Header */}
        <Show when={showsHeader(props.mode)}>
          <text fg={theme().text.base}>
            <b>Key Info</b>
          </text>
        </Show>

        {/* No data state */}
        <Show when={budgets().length === 0}>
          <Show
            when={props.mode === 'all'}
            fallback={<text fg={theme().text.muted}>No budget for the selected model</text>}
          >
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
        </Show>

        {/* Provider cards */}
        <For each={budgets()}>
          {(budget) => <ProviderCard budget={budget} theme={theme()} masked={props.mode === 'masked'} />}
        </For>
      </box>
    </Show>
  )
}
