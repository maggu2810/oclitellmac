export function matchesAny(id: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => toRegExp(pattern).test(id))
}

function toRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`, "i")
}
