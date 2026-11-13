<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import * as api from '../../api/asana'
import { useBoardContext } from '../../context'
import { useColorMenu } from '../../composables/useColorMenu'
import { taskLink } from '../../routes'
import { useToasts } from '../../composables/useToasts'
import { taskUploadsKey } from '../../composables/useImagePaste'
import StatusTimeline from './StatusTimeline.vue'
import { useTaskOpener } from '../../composables/useTaskOpener'
import { useTaskShortcuts } from '../../composables/useTaskShortcuts'
import { hasOpenLayer, useDismiss } from '../../layers'
import { setCommentCount } from '../../composables/useCommentCounts'
import { useTabChords } from '../../composables/useTabChords'
import { useCreateTask } from '../../composables/useCreateTask'
import { projectColor } from '../../composables/useSettings'
import { renderRichText } from '../../richtext'
import { asanaColor, textOn } from '../../colors'
import AvatarBadge from '../AvatarBadge.vue'
import UiIcon from '../UiIcon.vue'
import DatePicker from '../DatePicker.vue'
import ProjectIcon from '../ProjectIcon.vue'
import ActivityFeed from './ActivityFeed.vue'
import AttachmentList from './AttachmentList.vue'
import CommentComposer from './CommentComposer.vue'
import FieldValue from './FieldValue.vue'
import RichDescription from './RichDescription.vue'
import SubtaskList from './SubtaskList.vue'
import SelectMenu from '../SelectMenu.vue'
import { useDialog } from '../../composables/useDialog'
import TypeaheadPicker from './TypeaheadPicker.vue'
import type { Attachment, CustomField, Dependency, Section, Story, TaskDetail, TypeaheadResult } from '../../types'

const props = defineProps<{ gid: string; canGoBack: boolean; expanded: boolean }>()
const emit = defineEmits<{
  updated: [task: TaskDetail]
  open: [gid: string]
  back: []
  close: []
  'toggle-expand': []
}>()

const { project, me } = useBoardContext()
const colorMenu = useColorMenu()
const task = ref<TaskDetail | null>(null)
const stories = ref<Story[]>([])
const attachments = ref<Attachment[]>([])
const dependents = ref<Dependency[]>([])
provide(taskUploadsKey, { gid: props.gid, add: (attachment) => attachments.value.push(attachment) })
const fieldOrder = ref(new Map<string, string[]>())
const sectionOptions = ref(new Map<string, Section[]>())
const picker = ref<'assignee' | 'follower' | 'dependency' | 'dependent' | 'project' | 'parent' | null>(null)
const opener = useTaskOpener()
const dialog = useDialog()
const rootEl = ref<HTMLElement | null>(null)
const subtasksRef = ref<InstanceType<typeof SubtaskList> | null>(null)
const composerRef = ref<InstanceType<typeof CommentComposer> | null>(null)
const dueRef = ref<InstanceType<typeof DatePicker> | null>(null)

/** Shortcuts that act on the whole task do nothing while a subtask name is being typed. */
function onTask(action: () => void): () => boolean {
  return () => {
    if (!task.value || (document.activeElement as HTMLElement | null)?.hasAttribute('data-chords')) return false
    action()
    return true
  }
}

useTabChords(rootEl, {
  n: () => subtasksRef.value?.addSection(),
  s: () => subtasksRef.value?.addSubtask(),
  m: () => {
    if (!subtasksRef.value?.assignEditingToMe()) void save({ assignee: me.gid })
  },
  a: onTask(() => (picker.value = 'assignee')),
  f: onTask(() => (picker.value = 'follower')),
  p: onTask(() => (picker.value = 'project')),
  d: onTask(() => dueRef.value?.open()),
  c: onTask(() => composerRef.value?.focus()),
  l: onTask(() => void save({ liked: !task.value!.liked })),
  x: onTask(() => emit('toggle-expand')),
  q: onTask(() => useCreateTask().open()),
  backspace: onTask(deleteThisTask),
})

/** Ctrl+Enter completes or reopens the task, unless it is being used to save an editor. */
function onPanelKey(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || !task.value || hasOpenLayer()) return
  const target = event.target as HTMLElement
  if (target !== document.body && !rootEl.value?.contains(target)) return
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return
  event.preventDefault()
  void save({ completed: !task.value.completed })
}
onMounted(() => window.addEventListener('keydown', onPanelKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onPanelKey))
const shortcuts = useTaskShortcuts()

function togglePin(): void {
  moreOpen.value = false
  if (task.value) shortcuts.togglePin({ gid: task.value.gid, name: task.value.name, completed: task.value.completed })
}
const moreEl = ref<HTMLElement | null>(null)
const moreOpen = ref(false)
useDismiss(moreEl, moreOpen)

async function duplicate(): Promise<void> {
  moreOpen.value = false
  if (!task.value) return
  try {
    const gid = await api.duplicateTask(props.gid, `${task.value.name} (copy)`)
    toasts.action('Task duplicated', 'Open', () => emit('open', gid))
    opener.notify(await api.task(gid))
  } catch (e) {
    error.value = (e as Error).message
  }
}

function convertToTask(): void {
  moreOpen.value = false
  void changeProjects(async () => {
    await api.setParent(props.gid, null, {})
    if (project) await api.addProject(props.gid, project)
  })
}

function deleteThisTask(): void {
  moreOpen.value = false
  const gid = props.gid
  shortcuts.forget(gid)
  opener.notifyRemoved(gid)
  emit('close')
  toasts.deferred(
    'Task deleted',
    () => void api.deleteTask(gid).catch((e) => toasts.error((e as Error).message)),
    () => void api.task(gid).then(opener.notify).catch((e) => toasts.error((e as Error).message)),
  )
}
const error = ref<string | null>(null)
const toasts = useToasts()
watch(error, (message) => {
  if (!message) return
  toasts.error(message)
  if (task.value) error.value = null
})
const saving = ref(false)
const uploading = ref(false)
const copied = ref(false)
const name = ref('')
const titleEl = ref<HTMLTextAreaElement | null>(null)
const showStart = ref(false)

async function load(): Promise<void> {
  try {
    const [detail, feed, files] = await Promise.all([
      api.task(props.gid),
      api.stories(props.gid),
      api.attachments(props.gid),
    ])
    setTask(detail)
    stories.value = feed
    attachments.value = files
    void loadDependents()
    const orders = await Promise.all(
      detail.memberships.map(
        async (m) => [m.project.gid, (await api.projectFields(m.project.gid)).map((f) => f.gid)] as const,
      ),
    )
    fieldOrder.value = new Map(orders)
  } catch (e) {
    error.value = (e as Error).message
  }
}

const REFRESH_MS = 30_000

/** Nothing the user is in the middle of: no save running, no popup open, no text field in the panel being typed in. */
function idle(): boolean {
  if (saving.value || hasOpenLayer() || picker.value || document.visibilityState !== 'visible') return false
  const active = document.activeElement as HTMLElement | null
  if (!active || !rootEl.value?.contains(active)) return true
  return !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active.isContentEditable)
}

/** Picks up comments and changes made by others (or in Asana) while the task stays open. */
async function refresh(): Promise<void> {
  if (!task.value || !idle()) return
  try {
    const [detail, feed, files] = await Promise.all([api.task(props.gid), api.stories(props.gid), api.attachments(props.gid)])
    if (!task.value || !idle()) return
    if (detail.modified_at !== task.value.modified_at) {
      setTask(detail)
      emit('updated', detail)
    }
    const last = (list: { gid: string }[]): string => `${list.length}:${list[list.length - 1]?.gid ?? ''}`
    if (last(feed) !== last(stories.value)) stories.value = feed
    if (last(files) !== last(attachments.value)) attachments.value = files
  } catch {
    /* a background refresh may fail quietly; the next one tries again */
  }
}
const refreshTimer = setInterval(() => void refresh(), REFRESH_MS)
onBeforeUnmount(() => clearInterval(refreshTimer))

function setTask(detail: TaskDetail): void {
  const previous = task.value
  if (previous && previous.gid === detail.gid && detail.dependencies.every((d) => d.name === undefined)) {
    const known = new Map(previous.dependencies.map((d) => [d.gid, d]))
    detail.dependencies = detail.dependencies.map((d) => known.get(d.gid) ?? d)
  }
  shortcuts.record({ gid: detail.gid, name: detail.name, completed: detail.completed }, previous === null)
  task.value = detail
  name.value = detail.name
  showStart.value = Boolean(detail.start_on)
  void nextTick(autosize)
  if (detail.dependencies.some((d) => d.name === undefined)) void loadDependencies()
}

async function loadDependencies(): Promise<void> {
  try {
    const [deps, blocking] = await Promise.all([api.dependencies(props.gid), api.dependents(props.gid)])
    if (task.value) task.value.dependencies = deps
    dependents.value = blocking
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function loadDependents(): Promise<void> {
  try {
    dependents.value = await api.dependents(props.gid)
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function changeDependents(action: () => Promise<void>): Promise<void> {
  try {
    await action()
    await loadDependents()
  } catch (e) {
    error.value = (e as Error).message
  }
}

onMounted(load)
watch(name, () => void nextTick(autosize))

function autosize(): void {
  const el = titleEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** Runs a change against Asana; resolves to false (with the error shown) when it failed. */
async function run(action: () => Promise<unknown>, reload = false): Promise<boolean> {
  saving.value = true
  try {
    await action()
    if (reload) {
      setTask(await api.task(props.gid))
      emit('updated', task.value!)
    }
    error.value = null
    return true
  } catch (e) {
    error.value = (e as Error).message
    return false
  } finally {
    saving.value = false
  }
}

function save(fields: Record<string, unknown>): Promise<boolean> {
  return run(async () => {
    setTask(await api.updateTask(props.gid, fields))
    emit('updated', task.value!)
  })
}

function saveName(): void {
  const value = name.value.replace(/\n/g, ' ').trim()
  if (task.value && value && value !== task.value.name) void save({ name: value })
  else if (task.value) name.value = task.value.name
}

// The card on the board shows the comment count; keep it in step with what the panel has loaded.
watch(
  () => stories.value.filter((s) => s.type === 'comment').length,
  (count) => {
    if (task.value) setCommentCount(props.gid, count)
  },
)

const images = computed(() => new Map(attachments.value.map((a) => [a.gid, a.download_url ?? ''])))
const descriptionHtml = computed(() => renderRichText(task.value?.html_notes, images.value))
const inlineGids = computed(() => {
  const html = task.value?.html_notes ?? ''
  return new Set([...html.matchAll(/data-asana-gid="(\d+)"/g)].map((m) => m[1]))
})
const listedAttachments = computed(() => attachments.value.filter((a) => !inlineGids.value.has(a.gid)))

const groups = computed(() => {
  if (!task.value) return []
  const memberships = [...task.value.memberships].sort(
    (a, b) => Number(b.project.gid === project) - Number(a.project.gid === project),
  )
  const used = new Set<string>()
  const result = memberships.map((membership) => {
    const order = fieldOrder.value.get(membership.project.gid) ?? []
    const fields = order
      .map((gid) => task.value!.custom_fields.find((f) => f.gid === gid))
      .filter((f): f is CustomField => Boolean(f) && !used.has(f!.gid))
    fields.forEach((f) => used.add(f.gid))
    return { membership, fields }
  })
  const orphans = task.value.custom_fields.filter((f) => !used.has(f.gid))
  if (orphans.length && result.length) result[0].fields.push(...orphans)
  return result
})

async function loadSections(projectGid: string): Promise<void> {
  if (sectionOptions.value.has(projectGid)) return
  try {
    const list = await api.sections(projectGid)
    sectionOptions.value = new Map(sectionOptions.value).set(projectGid, list)
  } catch (e) {
    error.value = (e as Error).message
  }
}

/** The project's columns once loaded; until then just the task's current one, so the control shows its name. */
function sectionChoices(membership: TaskDetail['memberships'][number]): { value: string; label: string }[] {
  const loaded = sectionOptions.value.get(membership.project.gid)
  if (loaded) return loaded.map((s) => ({ value: s.gid, label: s.name }))
  return membership.section ? [{ value: membership.section.gid, label: membership.section.name }] : []
}

function moveToSection(section: string): void {
  void run(() => api.moveTask(section, props.gid, {}), true)
}

function saveField(field: CustomField, value: unknown): void {
  void save({ custom_fields: { [field.gid]: value } })
}

function onPick(item: TypeaheadResult): void {
  const kind = picker.value
  picker.value = null
  if (kind === 'assignee') void save({ assignee: item.gid })
  if (kind === 'follower') void run(() => api.addFollowers(props.gid, [item.gid]), true)
  if (kind === 'dependency') void run(() => api.addDependencies(props.gid, [item.gid]), true)
  if (kind === 'dependent' && item.gid !== props.gid) void changeDependents(() => api.addDependents(props.gid, [item.gid]))
  if (kind === 'project') void changeProjects(() => api.addProject(props.gid, item.gid))
  if (kind === 'parent' && item.gid !== props.gid) void changeProjects(() => api.setParent(props.gid, item.gid, {}))
}

async function changeProjects(action: () => Promise<void>): Promise<void> {
  saving.value = true
  try {
    await action()
    await load()
    if (task.value) emit('updated', task.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function removeFromProject(projectGid: string, projectName: string): Promise<void> {
  if (!(await dialog.confirm({ title: `Remove this task from ${projectName}?`, confirmLabel: 'Remove', danger: true }))) return
  void changeProjects(() => api.removeProject(props.gid, projectGid))
}

async function removeFollower(gid: string, personName: string): Promise<void> {
  if (!(await dialog.confirm({ title: `Remove ${personName} from collaborators?`, confirmLabel: 'Remove', danger: true }))) return
  void run(() => api.removeFollowers(props.gid, [gid]), true)
}

function removeDependency(gid: string): void {
  void run(() => api.removeDependencies(props.gid, [gid]), true)
}

async function copyLink(kind: 'vibesana' | 'asana' = 'vibesana'): Promise<void> {
  if (!task.value) return
  moreOpen.value = false
  const link = kind === 'asana' ? task.value.permalink_url : taskLink(project || null, props.gid)
  try {
    await navigator.clipboard.writeText(link)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
    toasts.success(kind === 'asana' ? 'Asana link copied' : 'Vibesana link copied')
  } catch {
    void dialog.prompt({ title: 'Copy the task link', message: 'The browser blocked copying, so copy it from here.', value: link, confirmLabel: 'Done' })
  }
}

async function upload(files: File[]): Promise<void> {
  uploading.value = true
  try {
    for (const file of files) attachments.value.push(await api.uploadAttachment(props.gid, file))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    uploading.value = false
  }
}

function removeAttachment(attachment: Attachment): void {
  void run(async () => {
    await api.deleteAttachment(attachment.gid)
    attachments.value = attachments.value.filter((a) => a.gid !== attachment.gid)
  })
}

async function sendComment(html: string, done: (sent: boolean) => void): Promise<void> {
  try {
    stories.value.push(await api.addComment(props.gid, html))
    error.value = null
    done(true)
  } catch (e) {
    error.value = (e as Error).message
    done(false)
  }
}

function stamp(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tagStyle(color: string | null): Record<string, string> {
  const hex = asanaColor(color)
  return hex ? { background: hex, color: textOn(hex) } : {}
}
</script>

<template>
  <div ref="rootEl" class="panel-root">
    <header class="top">
      <button v-if="canGoBack" class="btn-ghost icon" title="Back" aria-label="Back" @click="emit('back')"><UiIcon name="back" /></button>
      <button
        v-if="task"
        class="status"
        :class="{ done: task.completed }"
        :disabled="saving"
        @click="save({ completed: !task.completed })"
      >
        <span class="dot"><UiIcon name="check" :size="13" /></span>
        {{ task.completed ? 'Completed' : 'Mark complete' }}
      </button>
      <span class="spacer" />
      <template v-if="task">
        <button class="btn-ghost icon" :class="{ liked: task.liked }" title="Like" @click="save({ liked: !task.liked })">
          <UiIcon name="like" /><span v-if="task.num_likes" class="likes">{{ task.num_likes }}</span>
        </button>
        <button class="btn-ghost icon" :title="copied ? 'Copied!' : 'Copy Asana link to this task'" @click="copyLink('asana')">
          <UiIcon :name="copied ? 'check' : 'link'" />
        </button>
        <button
          class="btn-ghost icon"
          :class="{ liked: shortcuts.isPinned(task.gid) }"
          :title="shortcuts.isPinned(task.gid) ? 'Unpin from the sidebar' : 'Pin to the sidebar'"
          @click="togglePin"
        >
          <UiIcon name="pin" />
        </button>
        <a class="btn-ghost icon" :href="task.permalink_url" target="_blank" rel="noopener" data-external title="Open in Asana" aria-label="Open in Asana"><UiIcon name="external" /></a>
      </template>
      <div v-if="task" ref="moreEl" class="more-anchor">
        <button class="btn-ghost icon" title="More actions" aria-label="More actions" @click="moreOpen = !moreOpen"><UiIcon name="more" /></button>
        <div v-if="moreOpen" class="more-menu popup">
          <button @click="togglePin">{{ shortcuts.isPinned(task.gid) ? 'Unpin from the sidebar' : 'Pin to the sidebar' }}</button>
          <button @click="copyLink('asana')">Copy Asana link</button>
          <button @click="copyLink('vibesana')">Copy Vibesana link</button>
          <button @click="duplicate">Duplicate task</button>
          <button v-if="task.parent" @click="convertToTask">Convert to task</button>
          <button @click="picker = 'parent'; moreOpen = false">
            {{ task.parent ? 'Move under another task…' : 'Convert to subtask of…' }}
          </button>
          <button class="danger" @click="deleteThisTask">Delete task</button>
        </div>
        <TypeaheadPicker
          v-if="picker === 'parent'"
          type="task"
          placeholder="Parent task…"
          class="right"
          @pick="onPick"
          @close="picker = null"
        />
      </div>
      <button class="btn-ghost icon" :title="expanded ? 'Narrow' : 'Wide'" @click="emit('toggle-expand')">
        <UiIcon :name="expanded ? 'shrink' : 'expand'" />
      </button>
      <button class="btn-ghost icon" title="Close (Esc)" aria-label="Close (Esc)" @click="emit('close')"><UiIcon name="close" /></button>
    </header>

    <div class="scroll">
      <p v-if="error && !task" class="error">Could not load this task: {{ error }}</p>
      <div v-if="!task && !error" class="loading-task" aria-label="Loading task">
        <div class="skeleton" style="height: 30px; width: 70%; margin: 14px 0 18px" />
        <div class="sk-grid">
          <div v-for="n in 6" :key="n" class="sk-row">
            <div class="skeleton" style="height: 12px; width: 84px" />
            <div class="skeleton" :style="{ height: '20px', width: `${[120, 90, 70, 140, 60, 100][n - 1]}px` }" />
          </div>
        </div>
        <div class="skeleton" style="height: 11px; width: 96px; margin: 30px 0 12px" />
        <div v-for="w in [96, 88, 92, 60]" :key="w" class="skeleton" :style="{ height: '13px', width: `${w}%`, marginBottom: '9px' }" />
        <div class="skeleton" style="height: 11px; width: 80px; margin: 30px 0 12px" />
        <div v-for="w in [55, 70, 45]" :key="w" class="sk-row">
          <div class="skeleton" style="height: 18px; width: 18px; border-radius: 50%" />
          <div class="skeleton" :style="{ height: '13px', width: `${w}%` }" />
        </div>
      </div>

      <template v-if="task">
        <button v-if="task.parent" class="parent btn-ghost" @click="emit('open', task.parent.gid)">
          {{ task.parent.name }} ›
        </button>
        <textarea
          ref="titleEl"
          v-model="name"
          class="title"
          rows="1"
          @blur="saveName"
          @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
        />

        <div class="rows">
          <div class="row">
            <span class="label">Assignee</span>
            <div class="value anchor">
              <button v-if="task.assignee?.gid !== me.gid" class="btn-ghost tiny" @click="save({ assignee: me.gid })">
                Assign to me
              </button>
              <button class="person" @click="picker = 'assignee'">
                <AvatarBadge v-if="task.assignee" :person="task.assignee" :size="22" />
                <span v-else class="ghost-avatar"><UiIcon name="user" :size="15" /></span>
                <span :class="{ muted: !task.assignee }">{{ task.assignee?.name ?? 'Unassigned' }}</span>
              </button>
              <button v-if="task.assignee" class="btn-ghost x" title="Unassign" aria-label="Unassign" @click="save({ assignee: null })"><UiIcon name="close" :size="14" /></button>
              <TypeaheadPicker
                v-if="picker === 'assignee'"
                type="user"
                placeholder="Assign to…"
                class="right"
                @pick="onPick"
                @close="picker = null"
              />
            </div>
          </div>

          <div class="row">
            <span class="label">Due date</span>
            <div class="value">
              <button v-if="!showStart" class="btn-ghost tiny" @click="showStart = true">+ start</button>
              <template v-if="showStart">
                <DatePicker
                  :value="task.start_on"
                  placeholder="Start date"
                  :range-from="task.start_on"
                  :range-to="task.due_on"
                  @change="save({ start_on: $event })"
                />
                <span class="muted">–</span>
              </template>
              <DatePicker
                ref="dueRef"
                :value="task.due_on"
                placeholder="Set due date"
                :range-from="task.start_on"
                :range-to="task.due_on"
                @change="save({ due_on: $event })"
              />
            </div>
          </div>

          <div class="row first-col top">
            <span class="label" title="Tasks that must be finished before this one">Blocked by</span>
            <div class="value anchor">
              <span v-for="dep in task.dependencies" :key="dep.gid" class="dep">
                <span :class="{ ok: dep.completed }"><UiIcon :name="dep.completed ? 'check-circle' : 'circle'" :size="15" /></span>
                <button class="dep-name" @click="emit('open', dep.gid)">{{ dep.name ?? dep.gid }}</button>
                <button class="btn-ghost x" title="Remove" aria-label="Remove" @click="removeDependency(dep.gid)"><UiIcon name="close" :size="14" /></button>
              </span>
              <button class="btn-ghost tiny" @click="picker = 'dependency'">
                {{ task.dependencies.length ? '+ add' : 'Add task' }}
              </button>
              <TypeaheadPicker
                v-if="picker === 'dependency'"
                type="task"
                placeholder="Blocked by task…"
                class="right"
                @pick="onPick"
                @close="picker = null"
              />
            </div>
          </div>

          <div class="row top">
            <span class="label" title="Tasks that are waiting for this one">Blocking</span>
            <div class="value anchor">
              <span v-for="dep in dependents" :key="dep.gid" class="dep">
                <span :class="{ ok: dep.completed }"><UiIcon :name="dep.completed ? 'check-circle' : 'circle'" :size="15" /></span>
                <button class="dep-name" @click="emit('open', dep.gid)">{{ dep.name ?? dep.gid }}</button>
                <button
                  class="btn-ghost x"
                  title="Remove"
                  @click="changeDependents(() => api.removeDependents(props.gid, [dep.gid]))"
                >
                  <UiIcon name="close" :size="14" />
                </button>
              </span>
              <button class="btn-ghost tiny" @click="picker = 'dependent'">
                {{ dependents.length ? '+ add' : 'Add task' }}
              </button>
              <TypeaheadPicker
                v-if="picker === 'dependent'"
                type="task"
                placeholder="This task blocks…"
                class="right"
                @pick="onPick"
                @close="picker = null"
              />
            </div>
          </div>

          <div class="row">
            <span class="label">Collaborators</span>
            <div class="value anchor">
              <button
                v-for="person in task.followers"
                :key="person.gid"
                class="follower"
                :title="`${person.name} (click to remove)`"
                @click="removeFollower(person.gid, person.name)"
              >
                <AvatarBadge :person="person" :size="24" />
              </button>
              <button class="add-circle" title="Add collaborator" @click="picker = 'follower'">+</button>
              <TypeaheadPicker
                v-if="picker === 'follower'"
                type="user"
                placeholder="Add collaborator…"
                class="right"
                @pick="onPick"
                @close="picker = null"
              />
            </div>
          </div>

          <div v-if="task.tags.length" class="row wide">
            <span class="label">Tags</span>
            <div class="value">
              <span v-for="tag in task.tags" :key="tag.gid" class="tag" :style="tagStyle(tag.color)">{{ tag.name }}</span>
            </div>
          </div>

          <template v-for="group in groups" :key="group.membership.project.gid">
            <div class="row project-row wide">
              <span class="label">{{ group.membership.project.gid === project ? 'Project' : 'Also in' }}</span>
              <div class="value">
                <span class="project">
                  <ProjectIcon :project="group.membership.project" :size="20" />
                  {{ group.membership.project.name }}
                  <button
                    class="color-dot"
                    :style="{ background: projectColor(group.membership.project) ?? 'var(--muted)' }"
                    title="Change this project's color"
                    @click="colorMenu.open(group.membership.project, $event)"
                  />
                </span>
                <SelectMenu
                  compact
                  :label="`Column in ${group.membership.project.name}`"
                  :model-value="group.membership.section?.gid ?? ''"
                  :options="sectionChoices(group.membership)"
                  placeholder="—"
                  @open="loadSections(group.membership.project.gid)"
                  @update:model-value="moveToSection"
                />
                <button
                  class="btn-ghost x"
                  title="Remove from this project"
                  @click="removeFromProject(group.membership.project.gid, group.membership.project.name)"
                >
                  <UiIcon name="close" :size="14" />
                </button>
              </div>
            </div>
            <div v-for="field in group.fields" :key="field.gid" class="row field">
              <span class="label indent">{{ field.name }}</span>
              <div class="value">
                <FieldValue :field="field" @save="saveField(field, $event)" />
              </div>
            </div>
          </template>

          <div class="row wide slim">
            <span class="label">{{ task.memberships.length ? '' : 'Project' }}</span>
            <div class="value anchor">
              <button class="btn-ghost tiny" @click="picker = 'project'">
                {{ task.memberships.length ? '+ another project' : '+ Add to project' }}
              </button>
              <TypeaheadPicker
                v-if="picker === 'project'"
                type="project"
                placeholder="Search projects…"
                @pick="onPick"
                @close="picker = null"
              />
            </div>
          </div>
        </div>

        <RichDescription :html="descriptionHtml" :save="(xml) => save({ html_notes: xml })" />

        <SubtaskList ref="subtasksRef" :parent="task.gid" @open="emit('open', $event)" @error="error = $event" />

        <AttachmentList
          :attachments="listedAttachments"
          :uploading="uploading"
          @upload="upload"
          @remove="removeAttachment"
        />

        <StatusTimeline :stories="stories" :created-at="task.created_at" />

        <ActivityFeed
          :stories="stories"
          :images="images"
          @remove="stories = stories.filter((s) => s.gid !== $event)"
          @error="error = $event"
        />

        <footer class="stamps">
          <span>Created: {{ stamp(task.created_at) }}</span>
          <span v-if="task.completed_at">Completed: {{ stamp(task.completed_at) }}</span>
        </footer>
      </template>
    </div>

    <footer v-if="task" class="composer-wrap">
      <CommentComposer ref="composerRef" :draft-key="gid" @send="sendComment" />
    </footer>
  </div>
</template>

<style scoped>
.panel-root {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.top {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 14px 12px 18px;
  border-bottom: 1px solid var(--border);
}
.spacer {
  flex: 1;
}
.more-anchor {
  position: relative;
}
.more-menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  right: 0;
  min-width: 210px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}
.more-menu button {
  text-align: left;
  background: transparent;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.more-menu button:hover {
  background: var(--chip);
}
.more-menu .danger {
  color: var(--danger);
}
.icon {
  padding: 4px 9px;
  text-decoration: none;
  font-size: 15px;
  border-radius: var(--radius-sm);
}
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 32px;
  height: 32px;
}
.icon.liked {
  color: var(--accent);
  background: transparent;
}
.icon.liked :deep(svg) {
  fill: color-mix(in srgb, var(--accent) 22%, transparent);
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 70%, transparent));
}
:root[data-glow='off'] .icon.liked :deep(svg) {
  filter: none;
}
.likes {
  font-size: 12px;
  margin-left: 3px;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px 0 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--text);
  font-weight: 700;
}
.status .dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  border: 1.5px solid var(--border-strong);
  color: transparent;
}
.status:hover .dot {
  color: var(--ok);
  border-color: var(--ok);
}
.status.done {
  background: var(--ok);
  color: var(--ok-contrast);
  box-shadow: 0 0 16px color-mix(in srgb, var(--ok) 45%, transparent);
}
.status.done .dot {
  background: var(--ok-contrast);
  border-color: var(--ok-contrast);
  color: var(--ok);
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px 24px 24px;
}
.parent {
  font-size: 13px;
  padding: 4px 6px;
  margin: 4px 0 0 -6px;
}
.title {
  width: 100%;
  font-size: 22px;
  font-weight: 800;
  line-height: calc(1.3 * var(--text-scale));
  letter-spacing: -0.01em;
  margin: 6px 0 10px -10px;
  padding: 4px 10px;
  background: transparent;
  box-shadow: none;
  resize: none;
  overflow: hidden;
  color: var(--text-strong);
}
.title:hover {
  background: var(--surface-2);
}
.title:focus {
  background: var(--surface-2);
  box-shadow: var(--shadow-inset), 0 0 0 3px var(--accent-soft);
}
.scroll {
  container-type: inline-size;
}
.rows {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: 28px;
}
@container (max-width: 500px) {
  .rows {
    grid-template-columns: minmax(0, 1fr);
  }
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  min-width: 0;
  padding: 3px 0;
  border-bottom: 1px dashed var(--border);
}
.row.wide {
  grid-column: 1 / -1;
}
.row.first-col {
  grid-column-start: 1;
}
.row.top {
  align-items: flex-start;
}
.row.top > .label {
  line-height: 28px;
}
.row.project-row {
  margin-top: 10px;
  padding: 4px 6px 4px 10px;
  border-bottom: none;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.row.project-row .label {
  flex-basis: calc(94px * var(--text-scale));
}
.row.project-row .x {
  margin-left: auto;
}
.row.slim {
  min-height: 28px;
  border-bottom: none;
}
.label {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  flex: 0 0 calc(104px * var(--text-scale));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.label.indent {
  font-weight: 600;
}
.value {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.anchor {
  position: relative;
}
.row.field .value {
  flex: 1;
}
.row.field :deep(.value) {
  justify-content: flex-start;
  width: 100%;
}
.row.field :deep(.enum) {
  justify-content: flex-start;
  padding-left: 0;
}
.row.field :deep(input[type='number']) {
  appearance: textfield;
  -moz-appearance: textfield;
}
.row.field :deep(.inline) {
  text-align: left;
  margin-left: -6px;
  background: transparent;
  box-shadow: none;
  padding: 3px 6px;
}
.row.field :deep(.inline:hover),
.row.field :deep(.inline:focus) {
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
}
.tiny {
  font-size: 12px;
  padding: 3px 8px;
}
.x {
  padding: 0 5px;
  font-size: 11px;
}
.person {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  padding: 3px 10px 3px 3px;
  border-radius: var(--radius-pill);
  font-weight: 700;
}
.person:hover {
  background: var(--chip);
}
.ghost-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px dashed var(--border-strong);
  display: grid;
  place-items: center;
  font-size: 11px;
}
.follower {
  background: transparent;
  padding: 0;
  border-radius: 50%;
  display: flex;
  margin-left: -6px;
  border: 2px solid var(--surface);
}
.follower:first-child {
  margin-left: 0;
}
.add-circle {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  border: 1.5px dashed var(--border-strong);
  background: transparent;
  color: var(--muted);
  margin-left: 2px;
}
.add-circle:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}
.dep {
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
  border-radius: var(--radius-pill);
  padding: 2px 4px 2px 10px;
  font-size: 13px;
}
.dep .ok {
  color: var(--ok);
}
.dep-name {
  background: transparent;
  padding: 0;
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dep-name:hover {
  text-decoration: underline;
  background: transparent;
}
.tag {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 5px;
  background: var(--chip);
}
.project {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}
.color-dot {
  display: block;
  flex: none;
  align-self: center;
  width: 12px;
  height: 12px;
  padding: 0;
  margin: 0 0 0 2px;
  border: none;
  border-radius: 50%;
  line-height: 0;
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--border-strong);
}
.color-dot:hover {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--accent), var(--glow);
}
.stamps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 28px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--muted);
}
.composer-wrap {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.sk-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 28px;
}
.sk-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
}
.sk-row > .skeleton:last-child {
  flex: none;
}
.muted {
  color: var(--muted);
}
.error {
  color: var(--danger);
}
</style>
