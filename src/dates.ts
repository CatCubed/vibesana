export function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

export function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function daysFromToday(iso: string): number {
  return Math.round((parseISO(iso).getTime() - today().getTime()) / 86_400_000)
}

/** Every day from `start` to `due` inclusive (just the due day without a start, or when the range is backwards), capped. */
export function rangeDays(start: string | null | undefined, due: string, maxDays = 62): string[] {
  if (!start || start >= due) return [due]
  const days: string[] = []
  for (let date = parseISO(start); days.length < maxDays; date = addDays(date, 1)) {
    const iso = toISO(date)
    days.push(iso)
    if (iso >= due) break
  }
  return days
}

export function formatDay(iso: string, withYear = false): string {
  const date = parseISO(iso)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear || !sameYear ? { year: 'numeric' } : {}),
  })
}

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none'

/** Which My Tasks column a due date falls into, relative to `now`. */
export function dueBucket(dueOn: string | null, now: Date = today()): DueBucket {
  if (!dueOn) return 'none'
  const days = Math.round((parseISO(dueOn).getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'week'
  return 'later'
}

/** Number of ISO weeks in a year: 53 when 1 January is a Thursday, or a Wednesday in a leap year. */
export function isoWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1).getDay()
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return jan1 === 4 || (leap && jan1 === 3) ? 53 : 52
}

/**
 * For a column named like a week ("2026-w46"), the next week's name that no existing column uses yet.
 * Returns null for any other name, so only week-per-column boards get a suggestion.
 */
export function nextWeekColumn(name: string, existing: readonly string[]): string | null {
  const match = name.trim().match(/^(\d{4})-(w)(\d{2})$/i)
  if (!match) return null
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()))
  let year = Number(match[1])
  let week = Number(match[3])
  for (let i = 0; i < 120; i += 1) {
    week += 1
    if (week > isoWeeksInYear(year)) {
      year += 1
      week = 1
    }
    const candidate = `${year}-${match[2]}${String(week).padStart(2, '0')}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return null
}

/** ISO 8601 week number and the year that week belongs to. */
export function isoWeek(date: Date): { year: number; week: number } {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return { year: day.getUTCFullYear(), week }
}

/** True for a column named like "2026-w46" when that is the week containing `now`. */
export function isCurrentWeekColumn(name: string, now: Date = new Date()): boolean {
  const match = name.trim().match(/^(\d{4})-w(\d{2})$/i)
  if (!match) return false
  const { year, week } = isoWeek(now)
  return Number(match[1]) === year && Number(match[2]) === week
}
