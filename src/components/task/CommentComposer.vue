<script lang="ts">
/** Unsent comments by task, kept while the app is open. */
const drafts = new Map<string, string>()
</script>

<script setup lang="ts">
import FormatToolbar from './FormatToolbar.vue'
import { onMounted, ref } from 'vue'
import { useBoardContext } from '../../context'
import { serializeRichText } from '../../richtext'
import UiIcon from '../UiIcon.vue'
import { useImagePaste } from '../../composables/useImagePaste'
import { useFormatState } from '../../composables/useFormatState'
import { autoFormat, exitHeadingOnEnter, handleFormatHotkey, revertAutoFormat } from '../../richshortcuts'
import { handleListTab } from '../../richlists'
import { useSuggestions } from '../../composables/useSuggestions'
import SuggestionList from './SuggestionList.vue'
import { exitCodeOnEnter } from '../../richblocks'

const props = defineProps<{ draftKey?: string }>()
const emit = defineEmits<{ send: [html: string, done: (sent: boolean) => void] }>()

const context = useBoardContext()
const editor = ref<HTMLElement | null>(null)
const images = useImagePaste()
const formats = useFormatState(editor)
const empty = ref(true)
const focused = ref(false)
const sending = ref(false)
const suggest = useSuggestions(editor, { workspace: context.workspace, mentions: ['user', 'task', 'project'] })

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

function onInput(event?: Event): void {
  if (editor.value) autoFormat(editor.value, event)
  refreshEmpty()
  suggest.onInput()
}

function onKey(event: KeyboardEvent): void {
  if (suggest.onKeydown(event)) return
  if (editor.value && revertAutoFormat(editor.value, event)) return
  if (editor.value && handleListTab(editor.value, event)) return
  if (images.onKeydown(event)) return
  if (handleFormatHotkey(event)) return
  if (editor.value && exitHeadingOnEnter(editor.value, event)) return
  if (editor.value && exitCodeOnEnter(editor.value, event)) return
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
    <SuggestionList :items="suggest.items.value" :active="suggest.active.value" :anchor="suggest.anchor.value" @pick="suggest.pick" />
    <div
      ref="editor"
      class="rich input"
      contenteditable="true"
      data-placeholder="Add a comment — @ mentions a person, task or project"
      @input="onInput"
      @click="images.onClick"
      @paste="images.onPaste"
      @dragover.prevent
      @drop="images.onDrop"
      @keydown="onKey"
      @focus="focused = true"
      @blur="focused = false; suggest.close()"
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
</style>
