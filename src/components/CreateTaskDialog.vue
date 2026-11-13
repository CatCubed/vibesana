<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import SelectMenu from './SelectMenu.vue'
import { onMounted, ref, watch } from 'vue'
import * as api from '../api/asana'
import { useBoardContext } from '../context'
import { useCreateTask } from '../composables/useCreateTask'
import { useTaskOpener } from '../composables/useTaskOpener'
import { useToasts } from '../composables/useToasts'
import AvatarBadge from './AvatarBadge.vue'
import DatePicker from './DatePicker.vue'
import ProjectIcon from './ProjectIcon.vue'
import TypeaheadPicker from './task/TypeaheadPicker.vue'
import type { Person, Project, Section, TypeaheadResult } from '../types'

const props = defineProps<{ project: Project | null }>()

const context = useBoardContext()
const dialog = useCreateTask()
const opener = useTaskOpener()
const toasts = useToasts()

const nameInput = ref<HTMLInputElement | null>(null)
const name = ref('')
const notes = ref('')
const project = ref<Project | null>(props.project)
const sections = ref<Section[]>([])
const section = ref('')
const assignee = ref<Person | null>(null)
const dueOn = ref<string | null>(null)
const picker = ref<'project' | 'assignee' | null>(null)
const saving = ref(false)

async function loadSections(): Promise<void> {
  sections.value = []
  section.value = ''
  if (!project.value) return
  try {
    sections.value = await api.sections(project.value.gid)
    section.value = sections.value[0]?.gid ?? ''
  } catch (e) {
    toasts.error((e as Error).message)
  }
}

watch(project, loadSections)
onMounted(() => {
  nameInput.value?.focus()
  void loadSections()
})

function onPick(item: TypeaheadResult): void {
  if (picker.value === 'project') {
    project.value = { gid: item.gid, name: item.name, color: item.color ?? null, icon: item.icon ?? null }
  } else if (picker.value === 'assignee') {
    assignee.value = { gid: item.gid, name: item.name, photo: item.photo ?? null }
  }
  picker.value = null
}

async function create(openAfter: boolean): Promise<void> {
  const title = name.value.trim()
  if (!title || saving.value) return
  saving.value = true
  try {
    const fields: Record<string, unknown> = { name: title }
    if (notes.value.trim()) fields.notes = notes.value.trim()
    if (assignee.value) fields.assignee = assignee.value.gid
    if (dueOn.value) fields.due_on = dueOn.value
    if (project.value) {
      fields.projects = [project.value.gid]
      if (section.value) fields.memberships = [{ project: project.value.gid, section: section.value }]
    } else {
      fields.workspace = context.workspace
      if (!assignee.value) fields.assignee = context.me.gid
    }
    const task = await api.createTaskFull(fields)
    opener.notify(task)
    dialog.close()
    if (openAfter) opener.open(task.gid)
    else toasts.action('Task created', 'Open', () => opener.open(task.gid))
  } catch (e) {
    toasts.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="backdrop" @mousedown.self="dialog.close()" @keydown.esc.stop="dialog.close()">
    <form class="dialog panel" @submit.prevent="create(false)">
      <h2>New task</h2>
      <input ref="nameInput" v-model="name" class="name" placeholder="Task name" @keydown.ctrl.enter.prevent="create(true)" />

      <div class="grid">
        <span class="label">Project</span>
        <div class="value anchor">
          <button type="button" class="pick" @click="picker = 'project'">
            <template v-if="project"><ProjectIcon :project="project" :size="20" /> {{ project.name }}</template>
            <span v-else class="muted">No project (goes to My Tasks)</span>
          </button>
          <button v-if="project" type="button" class="btn-ghost x" title="No project" aria-label="No project" @click="project = null"><UiIcon name="close" :size="14" /></button>
          <TypeaheadPicker
            v-if="picker === 'project'"
            type="project"
            placeholder="Search projects…"
            @pick="onPick"
            @close="picker = null"
          />
        </div>

        <template v-if="project">
          <span class="label">Column</span>
          <div class="value">
            <SelectMenu v-model="section" label="Column" :options="sections.map((s) => ({ value: s.gid, label: s.name }))" />
          </div>
        </template>

        <span class="label">Assignee</span>
        <div class="value anchor">
          <button type="button" class="pick" @click="picker = 'assignee'">
            <template v-if="assignee"><AvatarBadge :person="assignee" :size="20" /> {{ assignee.name }}</template>
            <span v-else class="muted">{{ project ? 'Unassigned' : 'Me' }}</span>
          </button>
          <button v-if="assignee" type="button" class="btn-ghost x" title="Unassign" aria-label="Unassign" @click="assignee = null"><UiIcon name="close" :size="14" /></button>
          <button v-if="assignee?.gid !== context.me.gid" type="button" class="btn-ghost tiny" @click="assignee = context.me">
            Assign to me
          </button>
          <TypeaheadPicker
            v-if="picker === 'assignee'"
            type="user"
            placeholder="Assign to…"
            @pick="onPick"
            @close="picker = null"
          />
        </div>

        <span class="label">Due date</span>
        <div class="value">
          <DatePicker :value="dueOn" placeholder="No due date" align="left" @change="dueOn = $event" />
        </div>
      </div>

      <textarea v-model="notes" rows="4" placeholder="Description (optional)" />

      <footer>
        <span class="muted hint">Enter creates · Ctrl+Enter creates and opens</span>
        <button type="button" class="btn-ghost" @click="dialog.close()">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="!name.trim() || saving">Create task</button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: var(--backdrop);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 10vh;
}
.dialog {
  width: min(560px, calc(100% - 32px));
  padding: 20px 22px 16px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 16px;
}
.name {
  font-size: 17px;
  font-weight: 700;
  padding: 9px 12px;
}
.grid {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 8px 12px;
  align-items: center;
}
.label {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.value {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
}
.anchor {
  position: relative;
}
.pick {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px 5px 8px;
  border-radius: var(--radius-pill);
}
select {
  padding: 5px 10px;
}
.x {
  padding: 0 6px;
  font-size: 11px;
}
.tiny {
  font-size: 12px;
  padding: 3px 8px;
}
textarea {
  resize: vertical;
}
footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.hint {
  margin-right: auto;
  font-size: 12px;
}
.muted {
  color: var(--muted);
}
</style>
