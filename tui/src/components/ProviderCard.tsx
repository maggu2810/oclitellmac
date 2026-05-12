/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from '@opencode-ai/plugin/tui'
import type { RGBA } from '@opentui/core'
import type { ProviderBudget } from '../types'
import { formatCurrency, formatPercent, formatProgressBar, formatRelativeTime, formatAbsoluteTimeLocale } from '../utils/format'

interface ProviderCardProps {
  budget: ProviderBudget
  theme: TuiPluginApi['theme']['current']
}

/**
 * Individual provider budget card component
 */
export function ProviderCard(props: ProviderCardProps) {
  const { budget } = props
  const theme = () => props.theme

  return (
    <box
      flexDirection="column"
      gap={0}
      padding={1}
      marginBottom={1}
      borderStyle="rounded"
      borderColor={theme().border}
    >
      {/* Provider name */}
      <text fg={theme().text}>
        <b>{budget.providerName}</b>
      </text>

      {/* Progress bar */}
      <text fg={percentColor(budget.percentUsed, theme)}>
        {formatProgressBar(budget.spend, budget.limit)}
      </text>

      {/* Spend / Limit */}
      <text fg={theme().textMuted}>
        {formatCurrency(budget.spend)} / {formatCurrency(budget.limit)}
      </text>

      {/* Percentage used */}
      <text fg={percentColor(budget.percentUsed, theme)}>
        {formatPercent(budget.percentUsed)} used
      </text>

      {/* Remaining budget */}
      <text fg={theme().textMuted}>{formatCurrency(budget.remaining)} remaining</text>

      {/* Reset date */}
      <text fg={theme().textMuted}>
        Resets {formatRelativeTime(budget.resetAt)} ({budget.duration})
      </text>

      {/* Fetch timestamp */}
      <text fg={theme().textMuted}>
        Fetched {formatAbsoluteTimeLocale(budget.lastFetched)}
      </text>
    </box>
  )
}

/**
 * Choose color based on budget usage percentage
 */
function percentColor(
  percent: number,
  theme: () => TuiPluginApi['theme']['current'],
): RGBA {
  const t = theme()
  if (percent >= 90) return t.error // Red - danger zone
  if (percent >= 75) return t.warning // Yellow - warning
  return t.success // Green - healthy
}
