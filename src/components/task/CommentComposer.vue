<script lang="ts">
/** Unsent comments by task, kept while the app is open. */
const drafts = new Map<string, string>()
</script>

<script setup lang="ts">
import FormatToolbar from './FormatToolbar.vue'
import { onMounted, ref } from 'vue'
import * as api from '../../api/asana'
import { useBoardContext } from '../../context'
import { serializeRichText } from '../../richtext'
import UiIcon from '../UiIcon.vue'
import { useImagePaste } from '../../composables/useImagePaste'
import { useFormatState } from '../../composables/useFormatState'
import { autoFormat, exitHeadingOnEnter, handleFormatHotkey } from '../../richshortcuts'
import { exitCodeOnEnter } from '../../richblocks'
import AvatarBadge from '../AvatarBadge.vue'
import type { TypeaheadResult } from '../../types'

const props = defineProps<{ draftKey?: string }>()
const emit = defineEmits<{ send: [html: string, done: (sent: boolean) => void] }>()

interface MentionContext {
  node: Text
  start: number
  end: number
}

const context = useBoardContext()
const editor = ref<HTMLElement | null>(null)
const images = useImagePaste()
const formats = useFormatState(editor)
const empty = ref(true)
const focused = ref(false)
const sending = ref(false)
const suggestions = ref<TypeaheadResult[]>([])
const active = ref(0)
let mention: MentionContext | null = null
let timer: ReturnType<typeof setTimeout> | undefined

function refreshEmpty(): void {
  const el = editor.value
  empty.value = !el || (!el.textContent?.trim() && !el.querySelector('img, a[data-asana-gid]'))
  // An unsent comment survives switching to another task and back (until the page is reloaded).
  if (!props.draftKey || !el) return
  if (empty.value) drafts.delete(props.draftKey)
  else drafts.set(props.draftKey, el.innerHTML)
}

onMounted(() => {
  const draft = props.draftKey ? drafts.get(props.draftKey) : undefined
  if (!draft || !editor.value) return
  editor.value.innerHTML = draft
  refreshEmpty()
})

function findMention(): (MentionContext & { query: string }) | null {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !selection.isCollapsed) return null
  const node = selection.anchorNode
  if (!node || node.nodeType !== Node.TEXT_NODE || !editor.value?.contains(node)) return null
  const before = (node.textContent ?? '').slice(0, selection.anchorOffset)
  const match = before.match(/(^|\s)@([^\s@]{0,30})$/)
  if (!match) return null
  return { node: node as Text, start: before.length - match[2].length - 1, end: selection.anchorOffset, query: match[2] }
}

function onInput(event?: Event): void {
  if (editor.value) autoFormat(editor.value, event)
  refreshEmpty()
  clearTimeout(timer)
  const found = findMention()
  if (!found) {
    mention = null
    suggestions.value = []
    return
  }
  mention = found
  timer = setTimeout(async () => {
    try {
      suggestions.value = await api.typeahead(context.workspace, 'user', found.query)
      active.value = 0
    } catch {
      suggestions.value = []
    }
  }, 150)
}

function pick(user: TypeaheadResult): void {
  if (!mention) return
  const range = document.createRange()
  range.setStart(mention.node, mention.start)
  range.setEnd(mention.node, Math.min(mention.end, mention.node.length))
  range.deleteContents()
  const link = document.createElement('a')
  link.setAttribute('data-asana-gid', user.gid)
  link.setAttribute('data-asana-type', 'user')
  link.contentEditable = 'false'
  link.textContent = `@${user.name}`
  range.insertNode(link)
  const space = document.createTextNode(' ')
  link.after(space)
  const selection = window.getSelection()
  selection?.collapse(space, 1)
  mention = null
  suggestions.value = []
  refreshEmpty()
}

function onKey(event: KeyboardEvent): void {
  if (images.onKeydown(event)) return
  if (handleFormatHotkey(event)) return
  if (editor.value && exitHeadingOnEnter(editor.value, event)) return
  if (editor.value && exitCodeOnEnter(editor.value, event)) return
  if (suggestions.value.length) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      active.value = (active.value + step + suggestions.value.length) % suggestions.value.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      pick(suggestions.value[active.value])
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      suggestions.value = []
      return
    }
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    send()
  } else if (event.key === 'Enter' && !event.shiftKey) {
    const selection = window.getSelection()
    const inList = selection?.anchorNode && (selection.anchorNode.parentElement?.closest('li') ?? null)
    if (!inList) {
      event.preventDefault()
      document.execCommand('insertLineBreak')
    }
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    editor.value?.blur()
  }
}

defineExpose({ focus: () => editor.value?.focus() })

function send(): void {
  const el = editor.value
  if (!el || empty.value || sending.value) return
  sending.value = true
  // The draft is only cleared once Asana has the comment; a failed send keeps it for another try.
  emit('send', serializeRichText(el), (sent) => {
    sending.value = false
    if (!sent) return
    el.innerHTML = ''
    refreshEmpty()
  })
}
</script>

<template>
  <div class="composer" :class="{ focused, empty }">
    <ul v-if="suggestions.length" class="suggestions popup" role="listbox" aria-label="People to mention">
      <li
        v-for="(user, index) in suggestions"
        :key="user.gid"
        :class="{ active: index === active }"
        @mousedown.prevent="pick(user)"
      >
        <AvatarBadge :person="user" :size="20" /> {{ user.name }}
      </li>
    </ul>
    <div
      ref="editor"
      class="rich input"
      contenteditable="true"
      data-placeholder="Add a comment or @mention a teammate"
      @input="onInput"
      @click="images.onClick"
      @paste="images.onPaste"
      @dragover.prevent
      @drop="images.onDrop"
      @keydown="onKey"
      @focus="focused = true"
      @blur="focused = false"
    />
    <div class="bottom">
      <FormatToolbar compact :editor="editor" :active="formats" @change="refreshEmpty" />
      <span class="hint">Ctrl+Enter sends</span>
      <button class="send" :disabled="empty || sending" title="Send (Ctrl+Enter)" aria-label="Send (Ctrl+Enter)" @click="send"><UiIcon name="send" :size="16" /></button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  position: relative;
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: var(--radius);
  box-shadow: var(--shadow-inset);
  padding: 8px 8px 6px 12px;
}
.composer.focused {
  border-color: var(--accent-ring);
  box-shadow: var(--shadow-inset), 0 0 0 3px var(--accent-soft);
}
.input {
  min-height: 44px;
  max-height: 40vh;
  overflow-y: auto;
  outline: none;
  padding: 2px 0;
}
.composer.empty .input::before {
  content: attr(data-placeholder);
  color: var(--muted);
  pointer-events: none;
}
.input :deep(img) {
  max-height: 160px;
}
.input :deep(a[data-asana-gid]) {
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 5px;
  padding: 0 4px;
  font-weight: 700;
  text-decoration: none;
}
.bottom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
}
.send {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  padding: 0;
}
.send:not(:disabled) {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
}
.suggestions {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  width: 280px;
  list-style: none;
  margin: 0;
  padding: 4px;
  z-index: 5;
}
.suggestions li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.suggestions li.active {
  background: var(--chip);
}
</style>
