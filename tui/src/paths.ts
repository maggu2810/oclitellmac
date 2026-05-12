import { xdgState } from "xdg-basedir"
import path from "path"

/**
 * Centralized path management for oclitellmac TUI plugin
 * 
 * Uses xdg-basedir for XDG Base Directory compliance on Linux
 * and consistent Unix-style paths across all platforms (matching OpenCode core).
 * 
 * Environment variables respected:
 * - XDG_STATE_HOME: Override state directory
 */

// ============================================================================
// Base Directories
// ============================================================================

/**
 * State directory (persistent data that survives between sessions)
 * Default: ~/.local/state/oclitellmac
 * Override: XDG_STATE_HOME environment variable
 * 
 * Used for:
 * - Budget data (usage tracking, read by TUI)
 */
export const stateHome = xdgState
  ? path.join(xdgState, "oclitellmac")
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

// ============================================================================
// Specific Paths (most commonly used by consumers)
// ============================================================================

/**
 * Get budget data directory
 * Returns: ~/.local/state/oclitellmac/key-info
 * 
 * Used for: Budget/usage tracking data (written by server plugin)
 */
export function getBudgetDataDir(): string {
  return path.join(getStateDir(), "key-info")
}
