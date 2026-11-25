/** Adds the id to the set, or takes it out if it is already there. Returns a new set. */
export function toggled(picked: ReadonlySet<string>, gid: string): Set<string> {
  const next = new Set(picked)
  if (!next.delete(gid)) next.add(gid)
  return next
}

export function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((gid) => b.has(gid))
}

/**
 * The picked ids in the order to save them: values that are no longer offered as options first (they were
 * on the task already and must not be dropped just because they cannot be picked any more), then the
 * rest in the order the options are listed.
 */
export function inOptionOrder(options: readonly { gid: string }[], picked: ReadonlySet<string>, current: readonly { gid: string }[]): string[] {
  const offered = new Set(options.map((o) => o.gid))
  return [
    ...current.filter((c) => !offered.has(c.gid) && picked.has(c.gid)).map((c) => c.gid),
    ...options.filter((o) => picked.has(o.gid)).map((o) => o.gid),
  ]
}
