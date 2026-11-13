/** Index at which an item lands once it has been removed from its old place. */
export function landingIndex(sameList: boolean, fromIndex: number, toIndex: number): number {
  return sameList && fromIndex < toIndex ? toIndex - 1 : toIndex
}

/** True when dropping at `target` (a gap index) would leave the item where it is. */
export function isNoopMove(from: number, target: number): boolean {
  return target === from || target === from + 1
}

/** Moves the item at `from` to the gap `target`; returns the new list and the item's new index. */
export function moveItem<T>(list: readonly T[], from: number, target: number): { list: T[]; index: number } {
  const next = [...list]
  if (from < 0 || from >= next.length || isNoopMove(from, target)) return { list: next, index: from }
  const [item] = next.splice(from, 1)
  const index = landingIndex(true, from, target)
  next.splice(index, 0, item)
  return { list: next, index }
}

/** Which neighbour to anchor an inserted item to: the one before it if any, otherwise the one after. */
export function anchorFor<T>(list: readonly T[], index: number): { after?: T; before?: T } {
  if (index > 0) return { after: list[index - 1] }
  if (index + 1 < list.length) return { before: list[index + 1] }
  return {}
}

/**
 * Where Asana should put a task dropped into a column of another project.
 * Follows the previously dropped card when dragging several; otherwise sits before the card at the
 * drop position, after the one above it, or at the bottom of an empty column.
 */
export function crossDropPosition(
  previous: string | null,
  before: string | undefined,
  after: string | undefined,
  section: string,
): { insert_after?: string; insert_before?: string; section?: string } {
  if (previous) return { insert_after: previous }
  if (before) return { insert_before: before }
  if (after) return { insert_after: after }
  return { section }
}
