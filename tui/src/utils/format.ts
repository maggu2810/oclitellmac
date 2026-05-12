/** @jsxImportSource @opentui/solid */

/**
 * Format a number as USD currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Generate a text-based progress bar
 * @param value - Current value
 * @param max - Maximum value
 * @param width - Bar width in characters (default: 20)
 * @returns Progress bar string like "████████░░░░░░░░░░░░"
 */
export function formatProgressBar(value: number, max: number, width: number = 20): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1
  const percent = Math.min(1, safeValue / safeMax)
  const filled = Math.round(percent * width)
  const empty = width - filled

  return '█'.repeat(filled) + '░'.repeat(empty)
}

/**
 * Format ISO date string to readable date (YYYY-MM-DD)
 */
export function formatDate(isoString: string): string {
  try {
    return isoString.slice(0, 10)
  } catch {
    return 'unknown'
  }
}

/**
 * Format ISO date string to relative time (e.g., "in 3 days", "2 hours ago")
 */
export function formatRelativeTime(isoString: string | number): string {
  try {
    const date = typeof isoString === 'number' ? new Date(isoString) : new Date(isoString)
    const now = Date.now()
    const diff = date.getTime() - now
    const absDiff = Math.abs(diff)

    const seconds = Math.floor(absDiff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    const future = diff > 0

    if (days > 0) {
      return future ? `in ${days}d` : `${days}d ago`
    } else if (hours > 0) {
      return future ? `in ${hours}h` : `${hours}h ago`
    } else if (minutes > 0) {
      return future ? `in ${minutes}m` : `${minutes}m ago`
    } else {
      return future ? 'soon' : 'just now'
    }
  } catch {
    return 'unknown'
  }
}

/**
 * Format timestamp with smart display:
 * - Recent (< 1 hour): relative only ("2m ago", "45s ago")
 * - Today (< 24 hours): relative + time ("2h ago (2:33 PM)")
 * - Older: relative + date+time ("2d ago (5/9 2:33 PM)")
 * 
 * Respects system timezone via toLocaleTimeString/toLocaleDateString
 */
export function formatSmartTime(timestamp: number): string {
  try {
    const date = new Date(timestamp)
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    const relative = formatRelativeTime(timestamp)
    
    // Recent (< 1 hour): just relative
    if (diffMinutes < 60) {
      return relative
    }
    
    // Today (< 24 hours): relative + time
    if (diffHours < 24) {
      const timeStr = date.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
      return `${relative} (${timeStr})`
    }
    
    // Older: relative + date+time
    const dateStr = date.toLocaleDateString(undefined, { 
      month: 'numeric', 
      day: 'numeric' 
    })
    const timeStr = date.toLocaleTimeString(undefined, { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    return `${relative} (${dateStr} ${timeStr})`
  } catch {
    return 'unknown'
  }
}

/**
 * Format timestamp as absolute time (ISO-style)
 * Example: "2026-05-11 11:31:23"
 * 
 * Pros: Complete, unambiguous, sortable
 * Cons: Formal, takes more space
 */
export function formatAbsoluteTimeISO(timestamp: number): string {
  try {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch {
    return 'unknown'
  }
}

/**
 * Format timestamp as absolute time (locale-aware)
 * Example: "5/11/2026, 11:31:23 AM"
 * 
 * Respects system timezone and locale settings.
 * Shorter and more user-friendly than ISO format.
 */
export function formatAbsoluteTimeLocale(timestamp: number): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch {
    return 'unknown'
  }
}
