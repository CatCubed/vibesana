import { inject, type InjectionKey } from 'vue'
import * as api from '../api/asana'
import { handleRichPaste } from '../richtext'
import { useToasts } from './useToasts'
import type { Attachment } from '../types'

export interface TaskUploads {
  gid: string
  add: (attachment: Attachment) => void
}

export const taskUploadsKey: InjectionKey<TaskUploads> = Symbol('task-uploads')

function imagesOf(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

export function useImagePaste() {
  const uploads = inject(taskUploadsKey, null)
  const toasts = useToasts()

  async function insert(files: File[], editor: HTMLElement, range: Range | null): Promise<void> {
    if (!uploads) return
    toasts.info(files.length > 1 ? `Uploading ${files.length} images…` : 'Uploading image…')
    for (const file of files) {
      try {
        const attachment = await api.uploadAttachment(uploads.gid, file)
        uploads.add(attachment)
        if (!attachment.download_url) continue
        const img = document.createElement('img')
        img.setAttribute('data-asana-gid', attachment.gid)
        img.src = attachment.download_url
        img.alt = attachment.name
        if (range && editor.contains(range.commonAncestorContainer)) {
          range.insertNode(img)
          range.setStartAfter(img)
          range.collapse(true)
        } else {
          editor.appendChild(img)
        }
        editor.dispatchEvent(new Event('input', { bubbles: true }))
      } catch (e) {
        toasts.error(`Image upload failed: ${(e as Error).message}`)
      }
    }
  }

  function currentRange(): Range | null {
    const selection = window.getSelection()
    return selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
  }

  function onPaste(event: ClipboardEvent): void {
    const files = imagesOf(event.clipboardData?.files)
    if (!files.length || !uploads) {
      handleRichPaste(event)
      return
    }
    event.preventDefault()
    void insert(files, event.currentTarget as HTMLElement, currentRange())
  }

  function onDrop(event: DragEvent): void {
    const files = imagesOf(event.dataTransfer?.files)
    if (!files.length || !uploads) return
    event.preventDefault()
    event.stopPropagation()
    const point = document.caretRangeFromPoint?.(event.clientX, event.clientY) ?? currentRange()
    void insert(files, event.currentTarget as HTMLElement, point)
  }

  function unpick(editor: HTMLElement): void {
    editor.querySelectorAll('img.picked').forEach((img) => img.classList.remove('picked'))
  }

  function onClick(event: MouseEvent): void {
    const editor = event.currentTarget as HTMLElement
    unpick(editor)
    if (event.target instanceof HTMLImageElement) event.target.classList.add('picked')
  }

  function neighbourImage(backwards: boolean): HTMLImageElement | null {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !selection.isCollapsed) return null
    const { startContainer: node, startOffset: offset } = selection.getRangeAt(0)
    let candidate: Node | null
    if (node.nodeType === Node.TEXT_NODE) {
      const atEdge = backwards ? offset === 0 : offset === (node.textContent ?? '').length
      if (!atEdge) return null
      candidate = backwards ? node.previousSibling : node.nextSibling
    } else {
      candidate = node.childNodes[backwards ? offset - 1 : offset] ?? null
    }
    while (candidate && candidate.nodeType === Node.TEXT_NODE && !candidate.textContent) {
      candidate = backwards ? candidate.previousSibling : candidate.nextSibling
    }
    return candidate instanceof HTMLImageElement ? candidate : null
  }

  /** Returns true when the key removed an image and should not be handled further. */
  function onKeydown(event: KeyboardEvent): boolean {
    const editor = event.currentTarget as HTMLElement
    const picked = editor.querySelector('img.picked')
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      if (picked && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== 'Shift') unpick(editor)
      return false
    }
    const target = picked ?? neighbourImage(event.key === 'Backspace')
    if (!target) return false
    event.preventDefault()
    target.remove()
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  return { onPaste, onDrop, onClick, onKeydown }
}
