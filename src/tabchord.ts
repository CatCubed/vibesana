/**
 * Asana-style Tab shortcuts: hold Tab and press a key, or press Tab and then the key shortly after.
 * Pure state, so the timing rules can be tested without a browser.
 */
export function createChordTracker(windowMs = 1500) {
  let held = false
  let armedAt = Number.NEGATIVE_INFINITY
  let used = false
  return {
    /** Tab went down: the next key may complete a chord. */
    tabDown(now: number): void {
      if (!held) used = false
      held = true
      armedAt = now
    },
    /** Tab came up. Returns true when it was a plain tap (no chord key while it was held). */
    tabUp(): boolean {
      held = false
      return !used
    },
    /** Another key went down. Returns true when it completes a chord. */
    take(now: number): boolean {
      if (!held && now - armedAt >= windowMs) return false
      used = true
      if (!held) armedAt = Number.NEGATIVE_INFINITY
      return true
    },
    /** Forget a pending Tab, e.g. when focus moved into a text field. */
    disarm(): void {
      armedAt = Number.NEGATIVE_INFINITY
    },
  }
}

/** The name a chord handler is registered under for this key event, e.g. "m" or "backspace". */
export function chordKey(event: KeyboardEvent): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (event.key === 'Backspace' || event.key === 'Delete') return 'backspace'
  return /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : null
}
