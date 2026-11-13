import { describe, expect, it } from 'vitest'
import { addDays, dueBucket, parseISO, toISO } from './dates'

describe('toISO and addDays', () => {
  it('formats a local date', () => {
    expect(toISO(new Date(2026, 10, 9))).toBe('2026-11-09')
  })
  it('adds days across a month boundary', () => {
    expect(toISO(addDays(parseISO('2026-11-29'), 3))).toBe('2026-12-02')
  })
})

describe('dueBucket', () => {
  const now = parseISO('2026-11-12')

  it('has a bucket for no due date', () => {
    expect(dueBucket(null, now)).toBe('none')
  })
  it('sorts dates around today', () => {
    expect(dueBucket('2026-11-11', now)).toBe('overdue')
    expect(dueBucket('2026-11-12', now)).toBe('today')
    expect(dueBucket('2026-11-13', now)).toBe('tomorrow')
  })
  it('puts the next seven days in this week and the rest later', () => {
    expect(dueBucket('2026-11-14', now)).toBe('week')
    expect(dueBucket('2026-11-19', now)).toBe('week')
    expect(dueBucket('2026-11-20', now)).toBe('later')
  })
})

describe('nextWeekColumn', () => {
  it('suggests the following week', async () => {
    const { nextWeekColumn } = await import('./dates')
    expect(nextWeekColumn('2026-w46', ['Inbox', '2026-w46', '2026-w45'])).toBe('2026-w47')
  })
  it('skips weeks that already have a column', async () => {
    const { nextWeekColumn } = await import('./dates')
    expect(nextWeekColumn('2026-w45', ['2026-w46', '2026-w45', '2026-W47'])).toBe('2026-w48')
  })
  it('rolls over to the next year after the last week', async () => {
    const { nextWeekColumn, isoWeeksInYear } = await import('./dates')
    expect(isoWeeksInYear(2026)).toBe(53)
    expect(isoWeeksInYear(2025)).toBe(52)
    expect(nextWeekColumn('2026-w53', [])).toBe('2027-w01')
    expect(nextWeekColumn('2025-w52', [])).toBe('2026-w01')
  })
  it('keeps the letter case and zero padding', async () => {
    const { nextWeekColumn } = await import('./dates')
    expect(nextWeekColumn('2026-W08', [])).toBe('2026-W09')
  })
  it('suggests nothing for other names', async () => {
    const { nextWeekColumn } = await import('./dates')
    expect(nextWeekColumn('93. ms', [])).toBeNull()
    expect(nextWeekColumn('Inbox', [])).toBeNull()
    expect(nextWeekColumn('2026-w4', [])).toBeNull()
    expect(nextWeekColumn('Sprint 2026-w46', [])).toBeNull()
  })
})

describe('isoWeek and isCurrentWeekColumn', () => {
  it('computes ISO weeks, including year boundaries', async () => {
    const { isoWeek } = await import('./dates')
    expect(isoWeek(new Date(2026, 10, 12))).toEqual({ year: 2026, week: 46 })
    expect(isoWeek(new Date(2026, 0, 1))).toEqual({ year: 2026, week: 1 })
    expect(isoWeek(new Date(2026, 11, 31))).toEqual({ year: 2026, week: 53 })
    expect(isoWeek(new Date(2027, 0, 3))).toEqual({ year: 2026, week: 53 })
    expect(isoWeek(new Date(2027, 0, 4))).toEqual({ year: 2027, week: 1 })
    expect(isoWeek(new Date(2024, 11, 30))).toEqual({ year: 2025, week: 1 })
  })
  it('recognises the current week column', async () => {
    const { isCurrentWeekColumn } = await import('./dates')
    const now = new Date(2026, 10, 12)
    expect(isCurrentWeekColumn('2026-w46', now)).toBe(true)
    expect(isCurrentWeekColumn('2026-W46', now)).toBe(true)
    expect(isCurrentWeekColumn('2026-w47', now)).toBe(false)
    expect(isCurrentWeekColumn('2025-w46', now)).toBe(false)
    expect(isCurrentWeekColumn('Inbox', now)).toBe(false)
    expect(isCurrentWeekColumn('46', now)).toBe(false)
  })
})

describe('rangeDays', () => {
  it('is just the due day without a start date', async () => {
    const { rangeDays } = await import('./dates')
    expect(rangeDays(null, '2026-11-13')).toEqual(['2026-11-13'])
    expect(rangeDays('2026-11-13', '2026-11-13')).toEqual(['2026-11-13'])
  })
  it('lists every day of a range, across a month end', async () => {
    const { rangeDays } = await import('./dates')
    expect(rangeDays('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'])
  })
  it('ignores a start after the due date and caps very long ranges', async () => {
    const { rangeDays } = await import('./dates')
    expect(rangeDays('2026-12-24', '2026-12-01')).toEqual(['2026-12-01'])
    expect(rangeDays('2026-01-01', '2026-12-31', 10)).toHaveLength(10)
  })
})
