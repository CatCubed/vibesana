<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import { ref } from 'vue'
import RichEditor from './RichEditor.vue'

const props = defineProps<{ html: string; save: (xml: string) => Promise<boolean> }>()

const editing = ref(false)
const busy = ref(false)

function startEditing(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest('a')) return
  editing.value = true
}

/** The editor stays open, with the text in it, until Asana has accepted the change. */
async function save(xml: string): Promise<void> {
  busy.value = true
  const saved = await props.save(xml)
  busy.value = false
  if (saved) editing.value = false
}
</script>

<template>
  <div class="description">
    <div class="section-head">
      <h3 class="eyebrow">Description</h3>
      <button v-if="!editing" class="btn-ghost edit" @click="startEditing"><UiIcon name="edit" :size="14" /> Edit</button>
    </div>
    <RichEditor v-if="editing" :html="html" :busy="busy" close-on-leave @save="save" @cancel="editing = false" />
    <div v-else-if="html" class="rich view" title="Click to edit" @click="startEditing" v-html="html" />
    <div v-else class="rich view placeholder" @click="startEditing">What is this task about?</div>
  </div>
</template>

<style scoped>
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 28px 0 6px;
}
.section-head h3 {
  margin: 0;
}
.edit {
  font-size: 12px;
  padding: 3px 10px;
}
.view {
  cursor: text;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 8px;
  margin: 0 -8px;
}
.view:hover {
  border-color: var(--border);
}
.placeholder {
  color: var(--muted);
}
:deep(.editor) {
  min-height: 120px;
}
</style>
