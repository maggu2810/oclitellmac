import { xdgConfig, xdgState, xdgCache } from "xdg-basedir"
import path from "path"

/**
 * Centralized path management for oclitellmac server plugin
 * 
 * Uses xdg-basedir for XDG Base Directory compliance on Linux
 * and consistent Unix-style paths across all platforms (matching OpenCode core).
 * 
 * Environment variables respected:
 * - XDG_CONFIG_HOME: Override config directory
 * - XDG_STATE_HOME: Override state directory
 * - XDG_CACHE_HOME: Override cache directory
 */

// ============================================================================
// Base Directories
// ============================================================================

/**
 * Configuration directory
 * Default: ~/.config/oclitellmac
 * Override: XDG_CONFIG_HOME environment variable
 */
export const configHome = xdgConfig 
  ? path.join(xdgConfig, "oclitellmac")
  : undefined

/**
 * State directory (persistent data that survives between sessions)
 * Default: ~/.local/state/oclitellmac
 * Override: XDG_STATE_HOME environment variable
 * 
 * Used for:
 * - Provider cache (models, capabilities)
 * - Budget data (usage tracking)
 */
export const stateHome = xdgState
  ? path.join(xdgState, "oclitellmac")
  : undefined

/**
 * Cache directory (non-essential data that can be deleted)
 * Default: ~/.cache/oclitellmac
 * Override: XDG_CACHE_HOME environment variable
 * 
 * Currently unused, but available for future use.
 */
export const cacheHome = xdgCache
  ? path.join(xdgCache, "oclitellmac")
  : undefined

// ============================================================================
// Base Directory Getters (with validation)
// ============================================================================

/**
 * Get state directory path
 * @throws Error if XDG_STATE_HOME is not set and home directory unavailable
 */
export function getStateDir(): string {
  if (!stateHome) {
    throw new Error("XDG_STATE_HOME is not set and home directory could not be determined")
  }
  return stateHome
}

/**
 * Get config directory path
 * @throws Error if XDG_CONFIG_HOME is not set and home directory unavailable
 */
export function getConfigDir(): string {
  if (!configHome) {
    throw new Error("XDG_CONFIG_HOME is not set and home directory could not be determined")
  }
  return configHome
}

// ============================================================================
// Specific Paths (most commonly used by consumers)
// ============================================================================

/**
 * Get configuration file path
 * Returns: ~/.config/oclitellmac/server.json
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), "server.json")
}

/**
 * Get provider cache directory
 * Returns: ~/.local/state/oclitellmac/providers
 * 
 * Used for: Cached provider configurations and model lists
 */
export function getProviderCacheDir(): string {
  return path.join(getStateDir(), "providers")
}

/**
 * Get budget data directory
 * Returns: ~/.local/state/oclitellmac/key-info
 * 
 * Used for: Budget/usage tracking data (read by TUI plugin)
 */
export function getBudgetDataDir(): string {
  return path.join(getStateDir(), "key-info")
}
