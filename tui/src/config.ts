import { readFileSync } from 'fs'
import { getConfigPath } from './paths'
import { DEFAULT_LOG_LEVEL, parseLogLevel, type LogLevel } from './log'
import { DEFAULT_SIDEBAR_MODE, parseMode, type SidebarMode } from './view'

export interface TuiSettings {
  logLevel: LogLevel
  sidebarMode: SidebarMode
}

/**
 * Read options.tui from the plugin config file (default ~/.config/oclitellmac/server.json).
 * Never throws: a missing or invalid file or key yields the default.
 */
export function loadTuiSettings(configPath?: string): TuiSettings {
  const settings: TuiSettings = { logLevel: DEFAULT_LOG_LEVEL, sidebarMode: DEFAULT_SIDEBAR_MODE }
  try {
    const data = JSON.parse(readFileSync(configPath ?? getConfigPath(), 'utf-8'))
    const tui = data?.options?.tui
    settings.logLevel = parseLogLevel(tui?.logLevel)
    settings.sidebarMode = parseMode(tui?.sidebarMode) ?? DEFAULT_SIDEBAR_MODE
  } catch {
    // keep defaults
  }
  return settings
}
