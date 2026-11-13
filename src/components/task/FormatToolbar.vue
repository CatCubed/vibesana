<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import type { FormatState } from '../../composables/useFormatState'
import { setBlock, type BlockKind } from '../../richblocks'
import { wrapSelectionInCode } from '../../richshortcuts'
import { editLink } from '../../richlink'

/** The formatting buttons shared by the description editor and the comment box. */
const props = defineProps<{ editor: HTMLElement | null; active: FormatState; compact?: boolean }>()
const emit = defineEmits<{ change: [] }>()

type Icon = InstanceType<typeof UiIcon>['$props']['name']
interface Tool {
  title: string
  run: () => void
  on?: () => boolean
  icon?: Icon
  text?: string
  tag?: 'strong' | 'em' | 'u' | 's'
}

function changed(): void {
  props.editor?.dispatchEvent(new Event('input', { bubbles: true }))
  document.dispatchEvent(new Event('selectionchange'))
  emit('change')
}

function command(name: string): void {
  props.editor?.focus()
  document.execCommand('styleWithCSS', false, 'false')
  document.execCommand(name)
  changed()
}

function block(kind: BlockKind): void {
  if (!props.editor) return
  props.editor.focus()
  setBlock(props.editor, kind)
  changed()
}

function code(): void {
  props.editor?.focus()
  wrapSelectionInCode()
  changed()
}

function link(): void {
  if (!props.editor) return
  props.editor.focus()
  void editLink(props.editor).then(() => emit('change'))
}

const GROUPS: Tool[][] = [
  [
    { title: 'Bold (Ctrl+B)', run: () => command('bold'), on: () => props.active.bold, text: 'B', tag: 'strong' },
    { title: 'Italic (Ctrl+I)', run: () => command('italic'), on: () => props.active.italic, text: 'I', tag: 'em' },
    { title: 'Underline (Ctrl+U)', run: () => command('underline'), on: () => props.active.underline, text: 'U', tag: 'u' },
    { title: 'Strikethrough (Ctrl+Shift+X)', run: () => command('strikeThrough'), on: () => props.active.strike, text: 'S', tag: 's' },
    { title: 'Code (Ctrl+E)', run: code, on: () => props.active.code, icon: 'code' },
    { title: 'Bulleted list (Ctrl+Shift+8)', run: () => command('insertUnorderedList'), on: () => props.active.bullets, icon: 'bullets' },
    { title: 'Numbered list (Ctrl+Shift+7)', run: () => command('insertOrderedList'), on: () => props.active.numbers, icon: 'numbers' },
    { title: 'Link (Ctrl+K)', run: link, on: () => props.active.link, icon: 'link' },
  ],
  [
    { title: 'Large heading (Ctrl+Alt+1)', run: () => block('h1'), on: () => props.active.block === 'h1', text: 'H1' },
    { title: 'Medium heading (Ctrl+Alt+2)', run: () => block('h2'), on: () => props.active.block === 'h2', text: 'H2' },
    { title: 'Code block (Ctrl+Shift+C)', run: () => block('pre'), on: () => props.active.block === 'pre', icon: 'code-block' },
    { title: 'Quote block (type > and Space)', run: () => block('blockquote'), on: () => props.active.block === 'blockquote', icon: 'quote' },
    { title: 'Normal text (Ctrl+Alt+0)', run: () => block('p'), icon: 'paragraph' },
  ],
  [
    { title: 'Undo (Ctrl+Z)', run: () => command('undo'), icon: 'undo' },
    { title: 'Redo (Ctrl+Shift+Z)', run: () => command('redo'), icon: 'redo' },
  ],
]
</script>

<template>
  <div class="toolbar" :class="{ compact }" role="toolbar" aria-label="Text formatting">
    <template v-for="(group, index) in GROUPS" :key="index">
      <span v-if="index" class="sep" />
      <!-- mousedown keeps the text selection; a keyboard "click" (detail 0) runs the tool too -->
      <button
        v-for="tool in group"
        :key="tool.title"
        type="button"
        :class="{ on: tool.on?.() }"
        :title="tool.title"
        :aria-label="tool.title"
        :aria-pressed="tool.on ? tool.on() : undefined"
        @mousedown.prevent="tool.run()"
        @click="$event.detail === 0 && tool.run()"
      >
        <UiIcon v-if="tool.icon" :name="tool.icon" :size="15" />
        <component :is="tool.tag" v-else-if="tool.tag">{{ tool.text }}</component>
        <template v-else>{{ tool.text }}</template>
      </button>
    </template>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.toolbar.compact {
  gap: 2px;
}
.sep {
  width: 1px;
  align-self: stretch;
  margin: 3px 3px;
  background: var(--border);
}
button {
  min-width: 30px;
  padding: 2px 6px;
}
.compact button {
  background: transparent;
  color: var(--muted);
  min-width: 26px;
  padding: 1px 5px;
  font-size: 13px;
}
.compact button:hover {
  color: var(--text-strong);
  background: var(--chip);
}
button.on,
button.on:hover {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
</style>
