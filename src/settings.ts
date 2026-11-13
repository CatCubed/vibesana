export function readSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`asana-board:${key}`)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeSetting(key: string, value: unknown): void {
  try {
    localStorage.setItem(`asana-board:${key}`, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function removeSetting(key: string): void {
  try {
    localStorage.removeItem(`asana-board:${key}`)
  } catch {
    /* storage unavailable */
  }
}
