<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useFocusTrap } from '../composables/useFocusTrap'
import { pushLayer } from '../layers'
const emit = defineEmits<{ close: [] }>()

const dialogEl = ref<HTMLElement | null>(null)
useFocusTrap(dialogEl)
let removeLayer: (() => void) | null = null
onMounted(() => (removeLayer = pushLayer(() => emit('close'))))
onBeforeUnmount(() => removeLayer?.())

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      ['Ctrl K', 'Command bar: search tasks, @ projects, ! actions'],
      ['Shift N', 'New task'],
      ['?', 'This overview'],
      ['Esc', 'Close the open task, dialog or menu'],
      ['Alt ← / →', 'Back and forward (also the mouse side buttons)'],
    ],
  },
  {
    title: 'Board',
    keys: [
      ['← ↑ ↓ →', 'Move the focus between cards and columns'],
      ['Enter', 'Open the focused task'],
      ['C', 'Complete the focused task'],
      ['N', 'New task in the focused column'],
      ['X or Space', 'Select the focused card'],
      ['/', 'Search tasks on the board'],
      ['Ctrl + click', 'Add or remove a card from the selection'],
      ['Shift + click', 'Select a range of cards in a column'],
      ['Shift + drop', 'Move a card to another project instead of adding it'],
    ],
  },
  {
    title: 'Open task (hold Tab, or press Tab and then the key)',
    keys: [
      ['Tab + M', 'Assign to me'],
      ['Tab + A', 'Choose the assignee'],
      ['Tab + D', 'Set the due date'],
      ['Tab + C', 'Write a comment'],
      ['Tab + L', 'Like'],
      ['Tab + F', 'Add a collaborator'],
      ['Tab + P', 'Add to a project'],
      ['Tab + X', 'Wide / narrow panel'],
      ['Tab + Q', 'New task'],
      ['Tab + Backspace', 'Delete the task (with Undo)'],
      ['Ctrl Enter', 'Complete or reopen the task'],
    ],
  },
  {
    title: 'Subtasks',
    keys: [
      ['Enter', 'Add a subtask; in a row, save and add the next one'],
      ['Tab + N', 'Add a section'],
      ['Tab + S', 'Add a subtask'],
      ['Tab + M', 'Assign to me: the open task, or the subtask whose name you are editing'],
      ['Backspace', 'On an empty row: delete it and go to the row above'],
      ['↑ / ↓', 'Move between rows while editing'],
      ['Ctrl / Shift + click', 'Select rows; Delete removes them'],
    ],
  },
  {
    title: 'Text editors',
    keys: [
      ['Ctrl B / I / U', 'Bold, italic, underline'],
      ['Ctrl Shift X', 'Strikethrough'],
      ['Ctrl E', 'Code (selected text)'],
      ['Ctrl K', 'Link'],
      ['Ctrl Shift 8 / 7', 'Bullet list, numbered list'],
      ['Ctrl Alt 1 / 2 / 0', 'Large heading, medium heading, normal text'],
      ['Ctrl Shift C', 'Code block'],
      ['Ctrl Enter', 'Save the description or send the comment'],
      ['Esc', 'Description: save and close. Comment being edited: cancel (asks if changed)'],
    ],
  },
  {
    title: 'Typing shortcuts in editors',
    keys: [
      ['- or * then Space', 'Bullet list'],
      ['1. or 1) then Space', 'Numbered list (any starting number)'],
      ['# / ## then Space', 'Large / medium heading'],
      ['> then Space', 'Quote block'],
      ['---', 'Divider line (in descriptions)'],
      ['-> <- <-> => then Space', 'Arrows: → ← ↔ ⇒'],
      ['... or " -- " then Space', 'Ellipsis … and dash –'],
      [':name:', 'Emoji, e.g. :rocket: (a list appears after two letters)'],
      ['Backspace', 'Right after a conversion: undo it and get back what you typed'],
      ['Tab / Shift Tab', 'In a list: indent / outdent the item'],
      ['Paste a link on selected text', 'Turns the text into a link'],
      ['``` then Space', 'Code block'],
      ['`code`  **bold**  _italic_ or *italic*  ~~strike~~', 'Convert when the closing mark is typed'],
      ['@name', 'Mention a person, task or project'],
    ],
  },
]
</script>

<template>
  <div class="backdrop" @mousedown.self="emit('close')">
    <div ref="dialogEl" class="dialog panel" role="dialog" aria-modal="true" aria-labelledby="hotkeys-title">
      <header>
        <h2 id="hotkeys-title">Keyboard shortcuts</h2>
        <button class="btn-ghost" title="Close (Esc)" aria-label="Close (Esc)" @click="emit('close')"><UiIcon name="close" :size="14" /></button>
      </header>
      <div class="groups">
        <section v-for="group in GROUPS" :key="group.title">
          <h3 class="eyebrow">{{ group.title }}</h3>
          <dl>
            <template v-for="[keys, label] in group.keys" :key="keys">
              <dt><kbd>{{ keys }}</kbd></dt>
              <dd>{{ label }}</dd>
            </template>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 75;
  background: var(--backdrop);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 6vh 16px;
}
.dialog {
  width: min(980px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 10px;
}
h2 {
  margin: 0;
  font-size: 17px;
}
.groups {
  overflow-y: auto;
  padding: 0 20px 20px;
  columns: 2 380px;
  column-gap: 32px;
}
section {
  break-inside: avoid;
  margin-bottom: 18px;
}
h3 {
  margin: 8px 0 8px;
}
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 7px 14px;
  margin: 0;
  align-items: baseline;
}
dt {
  white-space: nowrap;
}
dd {
  margin: 0;
  font-size: 13px;
  color: var(--text);
}
kbd {
  font: 700 12px var(--font);
  font-size-adjust: var(--font-adjust);
  color: var(--text-strong);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 6px;
  padding: 2px 7px;
}
</style>
