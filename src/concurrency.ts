/** Runs `fn` over `items` with at most `limit` running at once; results keep the order of `items`. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker))
  return results
}

/** How long to wait before polling again after `failures` failed polls in a row. */
export function backoffMs(failures: number, base: number, max: number): number {
  return Math.min(max, base * 2 ** Math.max(0, failures))
}
