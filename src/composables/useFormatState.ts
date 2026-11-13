import { onBeforeUnmount, onMounted, reactive, type Ref } from 'vue'
import { blockAt, type BlockKind } from '../richblocks'

export interface FormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  bullets: boolean
  numbers: boolean
  link: boolean
  block: BlockKind
}

type FlagKey = Exclude<keyof FormatState, 'block'>

const SELECTORS: Record<FlagKey, string> = {
  bold: 'b, strong',
  italic: 'i, em',
  underline: 'u',
  strike: 's, strike, del',
  code: 'code, pre',
  bullets: 'ul',
  numbers: 'ol',
  link: 'a',
}

/** Which formats apply at `node`, looking only inside `editor`. */
export function formatsAt(editor: HTMLElement, node: Node | null): FormatState {
  const state: FormatState = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    bullets: false,
    numbers: false,
    link: false,
    block: blockAt(editor, node),
  }
  let element = node instanceof Element ? node : (node?.parentElement ?? null)
  if (!element || !editor.contains(element)) return state
  let nearestList: 'ul' | 'ol' | null = null
  while (element && element !== editor) {
    for (const key of Object.keys(SELECTORS) as FlagKey[]) {
      if (key === 'bullets' || key === 'numbers') continue
      if (element.matches(SELECTORS[key])) state[key] = true
    }
    const style = (element as HTMLElement).style
    if (style) {
      const weight = style.fontWeight
      if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) state.bold = true
      if (style.fontStyle === 'italic' || style.fontStyle === 'oblique') state.italic = true
      const decoration = `${style.textDecoration} ${style.textDecorationLine}`
      if (decoration.includes('underline')) state.underline = true
      if (decoration.includes('line-through')) state.strike = true
    }
    const tag = element.tagName.toLowerCase()
    if (!nearestList && (tag === 'ul' || tag === 'ol')) nearestList = tag
    element = element.parentElement
  }
  state.bullets = nearestList === 'ul'
  state.numbers = nearestList === 'ol'
  return state
}

/** Tracks the formatting at the caret or selection inside `editor`, for lighting up toolbar buttons. */
export function useFormatState(editor: Ref<HTMLElement | null>): FormatState {
  const state = reactive<FormatState>(formatsAt(document.createElement('div'), null))

  function update(): void {
    const el = editor.value
    const selection = window.getSelection()
    if (!el || !selection?.rangeCount) return
    if (!el.contains(selection.anchorNode)) {
      Object.assign(state, formatsAt(el, null))
      return
    }
    // A selection can be anchored on an element (offset = child index); look at the text it actually starts in.
    const range = selection.getRangeAt(0)
    let node: Node | null = range.startContainer
    if (node.nodeType === Node.ELEMENT_NODE) {
      node = node.childNodes[range.startOffset] ?? node.lastChild ?? node
      while (node.firstChild) node = node.firstChild
    } else if (!selection.isCollapsed && range.startOffset === (node.textContent ?? '').length && node.nextSibling) {
      node = node.nextSibling
      while (node.firstChild) node = node.firstChild
    }
    Object.assign(state, formatsAt(el, node))
  }

  onMounted(() => document.addEventListener('selectionchange', update))
  onBeforeUnmount(() => document.removeEventListener('selectionchange', update))
  return state
}
