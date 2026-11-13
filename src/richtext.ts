const RENDER_TAGS = new Set(['strong', 'em', 'u', 's', 'code', 'pre', 'blockquote', 'h1', 'h2', 'hr', 'ul', 'ol', 'li', 'a', 'img', 'br', 'table', 'tr', 'td'])
const SAFE_URL = /^(https?:|mailto:)/i

export function renderRichText(html: string | null | undefined, images: Map<string, string> = new Map()): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = document.createElement('div')
  for (const child of Array.from(doc.body.childNodes)) {
    const cleaned = clean(child, images)
    if (cleaned) out.appendChild(cleaned)
  }
  return out.innerHTML
}

function clean(node: Node, images: Map<string, string>): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '')
  if (!(node instanceof Element)) return null

  const tag = node.tagName.toLowerCase()
  if (tag === 'script' || tag === 'style') return null
  const children = document.createDocumentFragment()
  for (const child of Array.from(node.childNodes)) {
    const cleaned = clean(child, images)
    if (cleaned) children.appendChild(cleaned)
  }
  if (!RENDER_TAGS.has(tag)) return children

  const el = document.createElement(tag)
  const gid = node.getAttribute('data-asana-gid')
  if (gid) el.setAttribute('data-asana-gid', gid)

  if (tag === 'a') {
    const href = node.getAttribute('href') ?? ''
    if (SAFE_URL.test(href)) {
      el.setAttribute('href', href)
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    }
    const type = node.getAttribute('data-asana-type')
    if (type) el.setAttribute('data-asana-type', type)
    if (type === 'task' && gid && !el.getAttribute('href')) el.setAttribute('href', `https://app.asana.com/0/0/${gid}`)
  }

  if (tag === 'img') {
    const src = (gid && images.get(gid)) || node.getAttribute('src') || ''
    if (!SAFE_URL.test(src)) return null
    el.setAttribute('src', src)
    el.setAttribute('loading', 'lazy')
  }

  el.appendChild(children)
  return el
}

export function serializeRichText(root: HTMLElement): string {
  return `<body>${serializeChildren(root)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')}</body>`
}

function serializeChildren(node: Node): string {
  return Array.from(node.childNodes)
    .map((child, index) => serializeNode(child, index))
    .join('')
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (match) => {
    const trailing = match.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    const url = trailing ? match.slice(0, -trailing.length) : match
    return `<a href="${url.replace(/"/g, '&quot;')}">${url}</a>${trailing}`
  })
}

function escapeAttr(text: string): string {
  return escapeText(text).replace(/"/g, '&quot;')
}

function wrap(tag: string, inner: string): string {
  return inner ? `<${tag}>${inner}</${tag}>` : ''
}

function serializeNode(node: Node, index: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const escaped = escapeText((node.textContent ?? '').replace(/ /g, ' ').replace(/\u200b/g, ''))
    return node.parentElement?.closest('a, code, pre') ? escaped : linkify(escaped)
  }
  if (!(node instanceof Element)) return ''

  const tag = node.tagName.toLowerCase()
  const inner = () => serializeChildren(node)
  switch (tag) {
    case 'br':
      return '\n'
    case 'b':
    case 'strong':
      return wrap('strong', inner())
    case 'i':
    case 'em':
      return wrap('em', inner())
    case 'u':
      return wrap('u', inner())
    case 's':
    case 'strike':
    case 'del':
      return wrap('s', inner())
    case 'h1':
    case 'h2':
    case 'pre':
    case 'blockquote':
      return wrap(tag, inner().replace(/\n$/, ''))
    case 'code':
    case 'ul':
    case 'ol':
      return wrap(tag, inner())
    case 'li':
      return `<li>${inner().replace(/\n$/, '')}</li>`
    case 'hr':
      return '<hr/>'
    // Tables go back to Asana as tables; only the cells carry content, so stray whitespace between rows is dropped.
    case 'table': {
      const rows = [...node.querySelectorAll('tr')].filter((row) => row.closest('table') === node)
      return rows.length ? `<table>${rows.map((row, i) => serializeNode(row, i)).join('')}</table>` : ''
    }
    case 'tr':
      return `<tr>${[...node.children].map((cell, i) => serializeNode(cell, i)).join('')}</tr>`
    case 'td':
    case 'th':
      return `<td>${inner().replace(/\n$/, '')}</td>`
    case 'a': {
      const gid = node.getAttribute('data-asana-gid')
      if (gid) return `<a data-asana-gid="${escapeAttr(gid)}"/>`
      const href = node.getAttribute('href') ?? ''
      return SAFE_URL.test(href) ? `<a href="${escapeAttr(href)}">${inner()}</a>` : inner()
    }
    case 'img': {
      const gid = node.getAttribute('data-asana-gid')
      return gid ? `<img data-asana-gid="${escapeAttr(gid)}"/>` : ''
    }
    case 'div':
    case 'p':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
    case 'section':
    case 'article':
      return (index > 0 ? '\n' : '') + inner().replace(/\n$/, '')
    default:
      return styledWrap(node, inner())
  }
}

/** Browsers sometimes express formatting as inline styles on a span; keep it as real tags. */
function styledWrap(node: Element, inner: string): string {
  const style = (node as HTMLElement).style
  if (!style || !inner) return inner
  let result = inner
  const weight = style.fontWeight
  if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) result = wrap('strong', result)
  if (style.fontStyle === 'italic' || style.fontStyle === 'oblique') result = wrap('em', result)
  const decoration = `${style.textDecoration} ${style.textDecorationLine}`
  if (decoration.includes('underline')) result = wrap('u', result)
  if (decoration.includes('line-through')) result = wrap('s', result)
  return result
}

function normalizePastedWhitespace(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  for (const text of texts) {
    if (text.parentElement?.closest('pre')) continue
    const collapsed = (text.textContent ?? '').replace(/\s+/g, ' ')
    if (collapsed === ' ' && (!text.previousSibling || !text.nextSibling || /\n/.test(text.textContent ?? ''))) {
      text.remove()
    } else {
      text.textContent = collapsed
    }
  }
}

export function handleRichPaste(event: ClipboardEvent): void {
  const html = event.clipboardData?.getData('text/html')
  if (!html) return
  event.preventDefault()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  normalizePastedWhitespace(doc.body)
  const xml = serializeChildren(doc.body)
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
  document.execCommand('insertHTML', false, renderRichText(xml))
}
