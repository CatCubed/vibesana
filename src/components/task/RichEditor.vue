<script setup lang="ts">
import FormatToolbar from './FormatToolbar.vue'
import { onMounted, ref, watch } from 'vue'
import { serializeRichText } from '../../richtext'
import { useImagePaste } from '../../composables/useImagePaste'
import { useFormatState } from '../../composables/useFormatState'
import { autoFormat, exitHeadingOnEnter, handleFormatHotkey, revertAutoFormat } from '../../richshortcuts'
import { handleListTab } from '../../richlists'
import { useSuggestions } from '../../composables/useSuggestions'
import { useBoardContext } from '../../context'
import { useDialog } from '../../composables/useDialog'
import SuggestionList from './SuggestionList.vue'
import { exitCodeOnEnter } from '../../richblocks'

const props = defineProps<{ html: string; busy?: boolean; closeOnLeave?: boolean; divider?: boolean }>()
const emit = defineEmits<{ save: [xml: string]; cancel: [] }>()

const root = ref<HTMLElement | null>(null)
let initial = ''
/** Set once a save or cancel went out, so a click and the focus loss it causes do not both fire. */
let finished = false

// A save that came back (failed, or the parent kept the editor open) makes the editor usable again.
watch(
  () => props.busy,
  (busy) => {
    if (!busy) finished = false
  },
)

/** When focus leaves the whole editor (not just moves between its parts): save if changed, otherwise close. */
function onFocusOut(): void {
  if (!props.closeOnLeave) return
  setTimeout(() => {
    if (finished || !root.value || !editor.value) return
    if (!document.hasFocus() || root.value.contains(document.activeElement)) return
    // Focus went to one of our own dialogs or dropdowns (the link dialog): the edit is not over.
    if (document.activeElement?.closest('[data-layer]')) return
    finished = true
    const xml = serializeRichText(editor.value)
    if (xml === initial) emit('cancel')
    else emit('save', xml)
  }, 0)
}

const editor = ref<HTMLElement | null>(null)
const images = useImagePaste()
const active = useFormatState(editor)
const suggest = useSuggestions(editor, { workspace: useBoardContext().workspace, mentions: ['user', 'task', 'project'] })

function onInput(event: Event): void {
  if (editor.value) autoFormat(editor.value, event, { divider: props.divider })
  suggest.onInput()
}

/**
 * Esc never throws work away silently. Where leaving the editor saves (the description), Esc saves too;
 * elsewhere (editing a comment) it asks before discarding changes.
 */
async function escape(): Promise<void> {
  if (!editor.value || finished) return
  const changed = serializeRichText(editor.value) !== initial
  if (!changed) return cancel()
  if (props.closeOnLeave) return save()
  if (await useDialog().confirm({ title: 'Discard your changes?', confirmLabel: 'Discard', danger: true })) cancel()
}

onMounted(() => {
  if (!editor.value) return
  editor.value.innerHTML = props.html
  editor.value.focus()
  const selection = window.getSelection()
  selection?.selectAllChildren(editor.value)
  selection?.collapseToEnd()
  initial = serializeRichText(editor.value)
})

function save(): void {
  if (!editor.value || finished) return
  finished = true
  emit('save', serializeRichText(editor.value))
}

function cancel(): void {
  if (finished) return
  finished = true
  emit('cancel')
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
    save()
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    void escape()
  } else if (event.key === 'Enter' && !event.shiftKey) {
    const selection = window.getSelection()
    const inList = selection?.anchorNode && (selection.anchorNode.parentElement?.closest('li') ?? null)
    if (!inList) {
      event.preventDefault()
      document.execCommand('insertLineBreak')
    }
  }
}
</script>

<template>
  <div ref="root" class="rich-editor" @focusout="onFocusOut">
    <FormatToolbar class="toolbar" :editor="editor" :active="active" :divider="divider" />
    <SuggestionList :items="suggest.items.value" :active="suggest.active.value" :anchor="suggest.anchor.value" @pick="suggest.pick" />
    <div ref="editor" class="rich editor" contenteditable="true" @keydown="onKey" @input="onInput" @blur="suggest.close()" @click="images.onClick" @paste="images.onPaste" @dragover.prevent @drop="images.onDrop" />
    <div class="actions">
      <span class="muted" title="- or * list · 1. numbered · # heading · > quote · `code` · **bold** · _italic_ · ~~strike~~">
        {{ closeOnLeave ? 'Click outside, Esc or Ctrl+Enter saves' : 'Ctrl+Enter saves · Esc cancels' }} · Markdown shortcuts work
      </span>
      <button class="btn-ghost" @click="cancel">Cancel</button>
      <button class="btn-primary" :disabled="busy" @click="save">Save</button>
    </div>
  </div>
</template>

<style scoped>
.editor {
  border: 1px solid var(--accent-ring);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
  padding: 10px 12px;
  min-height: 90px;
  outline: none;
}
.toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.actions button {
  font-size: 13px;
  padding: 4px 14px;
}
.muted {
  margin-right: auto;
  font-size: 12px;
  color: var(--muted);
}
</style>
