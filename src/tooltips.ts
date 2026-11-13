/**
 * The app's own tooltips. Elements keep using the plain `title` attribute; when the pointer (or keyboard
 * focus) reaches one, its title is taken over so the browser's tooltip never shows, and a themed one does.
 */
const SHOW_DELAY_MS = 450
const GAP = 8

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** Where a tooltip of `width`×`height` goes for a target: centred under it, above when there is no room below, kept on screen. */
export function placeTooltip(target: Box, width: number, height: number, viewport: { width: number; height: number }): { left: number; top: number; above: boolean } {
  const above = target.bottom + GAP + height > viewport.height - 4 && target.top - GAP - height >= 4
  const centre = (target.left + target.right) / 2
  const left = Math.max(6, Math.min(centre - width / 2, viewport.width - width - 6))
  return { left, top: above ? target.top - GAP - height : target.bottom + GAP, above }
}

/** Moves a `title` into `data-tip` (keeping a spoken name for controls that have no other) and returns the text to show. */
export function claimTitle(el: Element): string {
  if (el.hasAttribute('title')) {
    const title = el.getAttribute('title') ?? ''
    el.removeAttribute('title')
    if (title) {
      el.setAttribute('data-tip', title)
      if (!el.hasAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', title)
    } else {
      el.removeAttribute('data-tip')
    }
  }
  return el.getAttribute('data-tip') ?? ''
}

export function installTooltips(): void {
  const tip = document.createElement('div')
  tip.className = 'app-tooltip'
  tip.setAttribute('role', 'tooltip')
  document.body.appendChild(tip)
  let timer: ReturnType<typeof setTimeout> | undefined
  let current: Element | null = null

  function hide(): void {
    clearTimeout(timer)
    current = null
    tip.classList.remove('show')
  }

  function show(el: Element, text: string): void {
    if (!el.isConnected) return
    tip.textContent = text
    tip.style.left = '0px'
    tip.style.top = '0px'
    const size = tip.getBoundingClientRect()
    const place = placeTooltip(el.getBoundingClientRect(), size.width, size.height, { width: window.innerWidth, height: window.innerHeight })
    tip.style.left = `${Math.round(place.left)}px`
    tip.style.top = `${Math.round(place.top)}px`
    tip.classList.add('show')
  }

  function arm(target: EventTarget | null, delay: number): void {
    const el = target instanceof Element ? target.closest('[title], [data-tip]') : null
    if (el === current) return
    hide()
    if (!el) return
    const text = claimTitle(el)
    if (!text) return
    current = el
    timer = setTimeout(() => show(el, text), delay)
  }

  document.addEventListener('mouseover', (event) => arm(event.target, SHOW_DELAY_MS), true)
  document.addEventListener('mouseout', (event) => {
    const next = event.relatedTarget
    if (current && !(next instanceof Node && current.contains(next))) hide()
  }, true)
  // Keyboard users get the tooltip of the control they tabbed to.
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof Element && event.target.matches(':focus-visible')) arm(event.target, 150)
  })
  document.addEventListener('focusout', hide)
  for (const type of ['mousedown', 'keydown', 'wheel', 'dragstart'] as const) document.addEventListener(type, hide, true)
  window.addEventListener('blur', hide)
}
