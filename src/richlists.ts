/** The list item the caret is in, if it is inside `editor`. */
export function listItemAt(editor: HTMLElement, node: Node | null): HTMLLIElement | null {
  const element = node instanceof Element ? node : (node?.parentElement ?? null)
  const item = element?.closest('li') ?? null
  return item && editor.contains(item) ? (item as HTMLLIElement) : null
}

function isList(node: Element | null | undefined): node is HTMLElement {
  return node?.tagName === 'UL' || node?.tagName === 'OL'
}

/** Makes the item a child of the item above it (one level deeper). False when there is no item above. */
export function indentListItem(item: HTMLLIElement): boolean {
  const list = item.parentElement
  const above = item.previousElementSibling
  if (!isList(list) || above?.tagName !== 'LI') return false
  const last = above.lastElementChild
  const nested = isList(last) ? last : above.appendChild(document.createElement(list.tagName.toLowerCase()))
  nested.appendChild(item)
  return true
}

/**
 * Moves the item one level up, to just after the item it was nested under. The items that followed it stay
 * below it, as its children. False at the top level.
 */
export function outdentListItem(item: HTMLLIElement): boolean {
  const list = item.parentElement
  const parent = list?.parentElement
  if (!isList(list) || parent?.tagName !== 'LI') return false
  const followers: Element[] = []
  for (let next = item.nextElementSibling; next; next = next.nextElementSibling) followers.push(next)
  if (followers.length) {
    const last = item.lastElementChild
    const nested = isList(last) ? last : item.appendChild(document.createElement(list.tagName.toLowerCase()))
    nested.append(...followers)
  }
  parent.after(item)
  if (!list.children.length) list.remove()
  return true
}

/** Tab / Shift+Tab inside a list item: indent / outdent it, as in Asana. Returns true when the key was for a list. */
export function handleListTab(editor: HTMLElement, event: KeyboardEvent): boolean {
  if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return false
  const selection = window.getSelection()
  const item = listItemAt(editor, selection?.anchorNode ?? null)
  if (!item || !selection) return false
  event.preventDefault()
  // Moving the item can drop the selection in some browsers: remember it and put it back.
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection
  const moved = event.shiftKey ? outdentListItem(item) : indentListItem(item)
  if (moved && anchorNode && focusNode) selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset)
  return true
}
