/** @jsxImportSource @opentui/solid */
import type { Plugin } from '@opencode/plugin/tui'
import type { RGBA } from '@opentui/core'
import { Show } from 'solid-js'
import type { ProviderBudget } from '../types'
import { formatCurrency, formatPercent, formatProgressBar, formatRelativeTime, formatAbsoluteTimeLocale } from '../utils/format'

interface ProviderCardProps {
  budget: ProviderBudget
  theme: Plugin.Context['theme']
  /** Only progress bar and percent: no names, amounts or dates */
  masked?: boolean
}

/**
 * Individual provider budget card component
 */
export function ProviderCard(props: ProviderCardProps) {
  const budget = () => props.budget
  const theme = () => props.theme
  const limit = () => budget().limit
  const percent = () => budget().percentUsed

  return (
    <box
      flexDirection="column"
      gap={0}
      padding={1}
      marginBottom={1}
      borderStyle="rounded"
      borderColor={theme().border.base}
    >
      <Show
        when={!props.masked}
        fallback={
          <Show
            when={limit() !== null && percent() !== null}
            fallback={<text fg={theme().text.muted}>No budget limit</text>}
          >
            <text fg={percentColor(percent()!, theme)}>
              {formatProgressBar(budget().spend, limit()!)} {formatPercent(percent()!)}
            </text>
          </Show>
        }
      >
        {/* Provider name */}
        <text fg={theme().text.base}>
          <b>{budget().providerName}</b>
        </text>

        <Show
          when={limit() !== null && percent() !== null}
          fallback={
            <>
              <text fg={theme().text.muted}>{formatCurrency(budget().spend)} spent</text>
              <text fg={theme().text.muted}>No budget limit</text>
            </>
          }
        >
          {/* Progress bar */}
          <text fg={percentColor(percent()!, theme)}>
            {formatProgressBar(budget().spend, limit()!)}
          </text>

          {/* Spend / Limit */}
          <text fg={theme().text.muted}>
            {formatCurrency(budget().spend)} / {formatCurrency(limit()!)}
          </text>

          {/* Percentage used */}
          <text fg={percentColor(percent()!, theme)}>
            {formatPercent(percent()!)} used
          </text>

          {/* Remaining budget */}
          <text fg={theme().text.muted}>{formatCurrency(budget().remaining ?? 0)} remaining</text>

          {/* Reset date */}
          <Show when={resetText(budget()) !== undefined}>
            <text fg={theme().text.muted}>{resetText(budget())}</text>
          </Show>
        </Show>

        {/* Fetch timestamp */}
        <text fg={theme().text.muted}>
          Fetched {formatAbsoluteTimeLocale(budget().lastFetched)}
        </text>
      </Show>
    </box>
  )
}

/**
 * Reset line, or undefined when the reset time is unknown
 */
function resetText(budget: ProviderBudget): string | undefined {
  if (!budget.resetAt || Number.isNaN(Date.parse(budget.resetAt))) return undefined
  const relative = `Resets ${formatRelativeTime(budget.resetAt)}`
  return budget.duration ? `${relative} (${budget.duration})` : relative
}

/**
 * Choose color based on budget usage percentage
 */
function percentColor(
  percent: number,
  theme: () => Plugin.Context['theme'],
): RGBA {
  const t = theme()
  if (percent >= 90) return t.text.feedback.error.base // Red - danger zone
  if (percent >= 75) return t.text.feedback.warning.base // Yellow - warning
  return t.text.feedback.success.base // Green - healthy
}
