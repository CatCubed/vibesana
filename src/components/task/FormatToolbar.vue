<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import type { FormatState } from '../../composables/useFormatState'
import { computed, ref } from 'vue'
import { insertDivider, setBlock, type BlockKind } from '../../richblocks'
import { EMOJI } from '../../emoji'
import { useDismiss } from '../../layers'
import { wrapSelectionInCode } from '../../richshortcuts'
import { editLink } from '../../richlink'

/** The formatting buttons shared by the description editor and the comment box. */
const props = defineProps<{ editor: HTMLElement | null; active: FormatState; compact?: boolean; divider?: boolean }>()
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

function divide(): void {
  if (!props.editor) return
  props.editor.focus()
  insertDivider(props.editor)
  changed()
}

const emojiRoot = ref<HTMLElement | null>(null)
const emojiOpen = ref(false)
useDismiss(emojiRoot, emojiOpen)
/** Each emoji once, with its first name as the tooltip. */
const EMOJI_LIST = [...new Map(Object.entries(EMOJI).map(([name, emoji]) => [emoji, name])).entries()].map(([emoji, name]) => ({ emoji, name }))

function insertEmoji(emoji: string): void {
  emojiOpen.value = false
  props.editor?.focus()
  document.execCommand('insertText', false, emoji)
  changed()
}

function link(): void {
  if (!props.editor) return
  props.editor.focus()
  void editLink(props.editor).then(() => emit('change'))
}

const GROUPS = computed<Tool[][]>(() => [
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
    // Asana accepts dividers in descriptions only.
    ...(props.divider ? [{ title: 'Divider line (type ---)', run: divide, icon: 'divider' as Icon }] : []),
  ],
  [
    { title: 'Undo (Ctrl+Z)', run: () => command('undo'), icon: 'undo' },
    { title: 'Redo (Ctrl+Shift+Z)', run: () => command('redo'), icon: 'redo' },
  ],
])
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
    <span class="sep" />
    <div ref="emojiRoot" class="emoji-anchor">
      <button
        type="button"
        :class="{ on: emojiOpen }"
        title="Emoji (or type :name:)"
        aria-label="Emoji"
        aria-haspopup="true"
        :aria-expanded="emojiOpen"
        @mousedown.prevent="emojiOpen = !emojiOpen"
        @click="$event.detail === 0 && (emojiOpen = !emojiOpen)"
      >
        <UiIcon name="smile" :size="15" />
      </button>
      <div v-if="emojiOpen" class="emoji-grid popup" :class="{ up: compact }" role="menu" aria-label="Emoji">
        <button
          v-for="item in EMOJI_LIST"
          :key="item.emoji"
          type="button"
          class="emoji"
          role="menuitem"
          :title="`:${item.name}:`"
          :aria-label="item.name"
          @mousedown.prevent="insertEmoji(item.emoji)"
          @click="$event.detail === 0 && insertEmoji(item.emoji)"
        >
          {{ item.emoji }}
        </button>
      </div>
    </div>
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
.emoji-anchor {
  position: relative;
  display: flex;
}
.emoji-grid {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  width: 288px;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}
/* In the comment box the toolbar sits at the bottom, so the grid opens upwards. */
.emoji-grid.up {
  top: auto;
  bottom: calc(100% + 6px);
}
.emoji-grid .emoji,
.compact .emoji-grid .emoji {
  min-width: 0;
  height: 32px;
  padding: 0;
  font-size: 18px;
  background: transparent;
  color: inherit;
}
.emoji-grid .emoji:hover {
  background: var(--chip);
}
button.on,
button.on:hover {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
</style>
