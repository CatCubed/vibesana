import { describe, expect, it } from 'vitest'
import { backoffMs, mapLimit } from './concurrency'

describe('mapLimit', () => {
  it('keeps the order of the input and never exceeds the limit', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
      peak = Math.max(peak, ++running)
      await new Promise((resolve) => setTimeout(resolve, n))
      running--
      return n * 10
    })
    expect(out).toEqual([50, 10, 40, 20, 30])
    expect(peak).toBe(2)
  })
  it('handles an empty list', async () => {
    expect(await mapLimit([], 4, async (n: number) => n)).toEqual([])
  })
  it('rejects when a call fails', async () => {
    await expect(mapLimit([1], 2, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
  })
})

describe('backoffMs', () => {
  it('doubles per failure up to the cap', () => {
    expect([0, 1, 2, 3, 4].map((n) => backoffMs(n, 15_000, 120_000))).toEqual([15_000, 30_000, 60_000, 120_000, 120_000])
  })
})
