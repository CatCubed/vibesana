export type Side = 'left' | 'right'
interface Span {
  left: number
  right: number
}

/**
 * Which edge of its trigger a popup of `width` should hang from so that it stays inside `bounds`.
 * 'left' means the popup's left edge lines up with the trigger's and it extends to the right.
 */
export function chooseSide(trigger: Span, bounds: Span, width: number, preferred: Side): Side {
  const fits = {
    left: trigger.left + width <= bounds.right - 8,
    right: trigger.right - width >= bounds.left + 8,
  }
  if (fits[preferred]) return preferred
  const other: Side = preferred === 'left' ? 'right' : 'left'
  if (fits[other]) return other
  // Neither fits: take the side with more room.
  return bounds.right - trigger.left >= trigger.right - bounds.left ? 'left' : 'right'
}

/** The area a popup anchored inside `el` can use before something clips it: the nearest clipping ancestor, else the window. */
export function clipBounds(el: HTMLElement): Span {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowX } = getComputedStyle(node)
    if (overflowX !== 'visible') {
      const rect = node.getBoundingClientRect()
      return { left: Math.max(rect.left, 0), right: Math.min(rect.right, window.innerWidth) }
    }
  }
  return { left: 0, right: window.innerWidth }
}

export function sideFor(el: HTMLElement, width: number, preferred: Side): Side {
  return chooseSide(el.getBoundingClientRect(), clipBounds(el), width, preferred)
}
