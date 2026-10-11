import type { BudgetData, ProviderBudget } from './types'

export type SidebarMode = 'current' | 'all' | 'hidden' | 'masked'

export const SIDEBAR_MODES: readonly SidebarMode[] = ['current', 'all', 'hidden', 'masked']
export const DEFAULT_SIDEBAR_MODE: SidebarMode = 'current'

export const MODE_DESCRIPTIONS: Record<SidebarMode, string> = {
  current: 'Budget of the selected model\'s provider',
  all: 'Budgets of all providers',
  hidden: 'Hide all budget information',
  masked: 'Only progress bar and percent of the selected provider',
}

/**
 * Parse a mode name (case-insensitive, surrounding whitespace ignored)
 */
export function parseMode(text: unknown): SidebarMode | undefined {
  if (typeof text !== 'string') return undefined
  const value = text.trim().toLowerCase()
  return SIDEBAR_MODES.find((mode) => mode === value)
}

/**
 * Budgets the sidebar renders for a mode.
 * `current` and `masked` only ever include the provider of the selected model.
 */
export function selectBudgets(
  mode: SidebarMode,
  budgets: BudgetData,
  providerID: string | undefined,
): ProviderBudget[] {
  if (mode === 'hidden') return []
  if (mode === 'all') return Object.values(budgets)
  if (!providerID) return []
  const budget = budgets[providerID] ?? Object.values(budgets).find((b) => b.providerKey === providerID)
  return budget ? [budget] : []
}

/**
 * Whether the panel header is shown (hidden/masked avoid advertising names)
 */
export function showsHeader(mode: SidebarMode): boolean {
  return mode === 'all' || mode === 'current'
}
