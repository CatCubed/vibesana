<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import * as api from './api/asana'
import ActivityView from './components/ActivityView.vue'
import HotkeysDialog from './components/HotkeysDialog.vue'
import ImageLightbox from './components/ImageLightbox.vue'
import AppSidebar from './components/AppSidebar.vue'
import BoardView from './components/BoardView.vue'
import CommandBar from './components/CommandBar.vue'
import CreateTaskDialog from './components/CreateTaskDialog.vue'
import MyTasksView from './components/MyTasksView.vue'
import ProjectColorMenu from './components/ProjectColorMenu.vue'
import ProjectIcon from './components/ProjectIcon.vue'
import TaskDrawer from './components/TaskDrawer.vue'
import ToastHost from './components/ToastHost.vue'
import DialogHost from './components/DialogHost.vue'
import TokenSetup from './components/TokenSetup.vue'
import { useActivity } from './composables/useActivity'
import { isUnreachable, useConnection } from './composables/useConnection'
import { useColorMenu } from './composables/useColorMenu'
import { useLayout } from './composables/useLayout'
import { useCreateTask } from './composables/useCreateTask'
import { useLightbox } from './composables/useLightbox'
import { useSettings } from './composables/useSettings'
import { useTaskOpener } from './composables/useTaskOpener'
import { useToasts } from './composables/useToasts'
import { boardContextKey, type BoardContext } from './context'
import { asanaTaskGid, buildHash, parseHash, sameNavState } from './routes'
import { readSetting, removeSetting, writeSetting } from './settings'
import { clearCache } from './cache'
import type { Named, Person, Project } from './types'

const settings = useSettings()
const colorMenu = useColorMenu()
const opener = useTaskOpener()
const lightbox = useLightbox()
const toasts = useToasts()
const createTask = useCreateTask()
const me = ref<(Person & { workspaces: Named[] }) | null>(null)
const workspace = ref<string | null>(null)
const project = ref<Project | null>(readSetting<Project | null>('project', null))
type View = 'board' | 'my' | 'activity'
const activity = useActivity()
const view = ref<View>(readSetting<View>('view', 'board'))
const commandOpen = ref(false)
const hotkeysOpen = ref(false)
const boardKey = ref(0)
const tokenError = ref<string | null>(null)
const connectError = ref<string | null>(null)
const connection = useConnection()
const needsToken = ref(!api.getToken())
const sidebar = ref<InstanceType<typeof AppSidebar> | null>(null)

const context = reactive<BoardContext>({ workspace: '', project: '', me: { gid: '', name: '', photo: null } })
provide(boardContextKey, context)
// Split view: a second project shown beside the main one.
const layout = useLayout()
const split = ref<Project | null>(readSetting<Project | null>('split', null))
const splitRatio = ref(readSetting('split-ratio', 0.5))
const activePane = ref<'main' | 'split'>('main')
const panes = ref<HTMLElement | null>(null)
const splitShown = computed(
  () => view.value === 'board' && project.value !== null && split.value !== null && split.value.gid !== project.value.gid,
)

watch(split, (value) => writeSetting('split', value))
watch(splitRatio, (value) => writeSetting('split-ratio', value))
watch(
  splitShown,
  (shown) => {
    layout.split = shown
    if (!shown) activePane.value = 'main'
  },
  { immediate: true },
)

function openSplit(tab: Project): void {
  if (tab.gid === project.value?.gid) return
  split.value = { gid: tab.gid, name: tab.name, color: tab.color ?? null, icon: tab.icon ?? null }
  if (view.value !== 'board') showView('board')
}

/** Closing a pane of the split view leaves the other project as the single board. */
function closePane(pane: 'main' | 'split'): void {
  if (pane === 'main' && split.value) {
    project.value = split.value
    writeSetting('project', split.value)
    pushPage()
  }
  split.value = null
}

function startResize(event: PointerEvent): void {
  const el = panes.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const onMove = (move: PointerEvent) => {
    splitRatio.value = Math.min(0.8, Math.max(0.2, (move.clientX - rect.left) / rect.width))
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  event.preventDefault()
}

watch([workspace, project, split, activePane, me], () => {
  context.workspace = workspace.value ?? ''
  const shown = activePane.value === 'split' && split.value ? split.value : project.value
  context.project = shown?.gid ?? ''
  if (me.value) context.me = me.value
})
watch(view, (value) => writeSetting('view', value))
// Activity is a popup beside the sidebar, not a page. Old links and saved state that say "activity" open it.
const activityOpen = ref(false)
const activityPop = ref<HTMLElement | null>(null)
watch(
  view,
  (value) => {
    if (value !== 'activity') return
    view.value = 'board'
    activityOpen.value = true
  },
  { immediate: true },
)
activity.onNotificationClick(() => (activityOpen.value = true))

function onActivityOutside(event: MouseEvent): void {
  if (!activityOpen.value) return
  const target = event.target as HTMLElement
  if (activityPop.value?.contains(target) || target.closest('[data-activity-toggle], .drawer, .host, .backdrop')) return
  activityOpen.value = false
}
watch([workspace, me], () => {
  if (workspace.value && me.value) void activity.start(workspace.value, me.value.gid)
})

interface NavState {
  view: View
  project: Project | null
  task: string | null
  stack: string[]
}

/**
 * Browser history works like in any site: every step is its own entry — opening a task, switching to
 * another one, closing it, changing the project or view. Back undoes the last step, Forward redoes it.
 */
let applyingHistory = false

function navState(): NavState {
  return JSON.parse(
    JSON.stringify({
      view: view.value,
      project: project.value,
      task: opener.state.gid,
      stack: opener.state.stack,
    }),
  ) as NavState
}

function hashOf(state: NavState): string {
  return buildHash({ view: state.view, project: state.project?.gid ?? null, task: state.task })
}

async function applyHash(): Promise<void> {
  const route = parseHash(window.location.hash)
  if (!route) return
  applyingHistory = true
  try {
    if (route.view) view.value = route.view
    if (route.project && route.project !== project.value?.gid) {
      try {
        const loaded = await api.project(route.project)
        project.value = { gid: loaded.gid, name: loaded.name, color: loaded.color ?? null, icon: loaded.icon ?? null }
        writeSetting('project', project.value)
      } catch (e) {
        toasts.error(`Could not open the linked project: ${(e as Error).message}`)
      }
    }
    opener.state.gid = null
    opener.state.stack = []
    const base = navState()
    window.history.replaceState(base, '', hashOf(base) || window.location.pathname)
    if (route.task) {
      opener.state.gid = route.task
      opener.state.stack = [route.task]
      const withTask = navState()
      window.history.pushState(withTask, '', hashOf(withTask))
    }
  } finally {
    applyingHistory = false
  }
}

function pushHistory(): void {
  if (applyingHistory) return
  try {
    const state = navState()
    // Nothing changed since the current entry (a repeated click): no second, identical step.
    if (sameNavState(window.history.state as NavState | null, state)) return
    window.history.pushState(state, '', hashOf(state) || window.location.pathname)
  } catch (e) {
    console.warn('history push failed', e)
  }
}

function applyHistory(state: NavState | null): void {
  if (!state || !('view' in state)) return
  applyingHistory = true
  view.value = state.view
  if ((state.project?.gid ?? null) !== (project.value?.gid ?? null)) {
    project.value = state.project
    writeSetting('project', state.project)
  }
  opener.state.gid = state.task ?? null
  opener.state.stack = state.stack ?? []
  applyingHistory = false
}

function onPopState(event: PopStateEvent): void {
  const state = event.state as NavState | null
  if (state && typeof state === 'object' && 'view' in state) applyHistory(state)
  else void applyHash()
}

function pushPage(): void {
  pushHistory()
}

// Opening a task, switching to another one and closing it are each a step of their own.
opener.onNavigate(pushHistory)
opener.onClose(pushHistory)

async function connect(): Promise<void> {
  try {
    me.value = await api.me()
    needsToken.value = false
    tokenError.value = null
    const saved = readSetting<string | null>('workspace', null)
    workspace.value = me.value.workspaces.some((w) => w.gid === saved)
      ? saved
      : (me.value.workspaces[0]?.gid ?? null)
    connectError.value = null
    connection.reset()
  } catch (e) {
    // Being offline says nothing about the token: keep it, say what is wrong, and try again shortly.
    if (isUnreachable(e)) {
      connectError.value = (e as Error).message
      setTimeout(() => void connect(), 5000)
      return
    }
    needsToken.value = true
    tokenError.value = e instanceof api.AsanaError && e.status === 401 ? 'Token rejected by Asana.' : (e as Error).message
  }
}

// A token revoked mid-session shows the token screen instead of an endless run of failing requests.
watch(
  () => connection.state.unauthorized,
  (unauthorized) => {
    if (!unauthorized) return
    activity.stop()
    me.value = null
    needsToken.value = true
    tokenError.value = 'Asana no longer accepts this token. Paste a new one.'
  },
)

function saveToken(token: string): void {
  api.setToken(token)
  void connect()
}

/** Signing out leaves nothing of this account behind: no polling, no cached boards, no open tabs or task shortcuts. */
function signOut(): void {
  activity.stop()
  api.setToken(null)
  void clearCache()
  for (const key of ['tabs', 'split', 'project', 'view', 'workspace', 'recent-tasks', 'pinned-tasks', 'activity-read', 'activity-seen']) {
    removeSetting(key)
  }
  window.location.replace(window.location.pathname)
}

function pickWorkspace(gid: string): void {
  workspace.value = gid
  writeSetting('workspace', gid)
  project.value = null
  writeSetting('project', null)
}

const commandInitial = ref('')
function closeCommand(): void {
  commandOpen.value = false
  commandInitial.value = ''
}

/**
 * Opens a project. `beside` (Ctrl+click or middle-click in the sidebar) shows it next to the current board;
 * in split view a plain pick replaces whichever pane has the focus.
 */
function pickProject(picked: Project, beside = false): void {
  const entry: Project = { gid: picked.gid, name: picked.name, color: picked.color ?? null, icon: picked.icon ?? null }
  const shown = entry.gid === project.value?.gid || entry.gid === split.value?.gid
  if (view.value === 'board' && project.value && !shown && (beside || (splitShown.value && activePane.value === 'split'))) {
    openSplit(entry)
    return
  }
  if (splitShown.value && shown) {
    activePane.value = entry.gid === split.value?.gid ? 'split' : 'main'
    return
  }
  if (split.value?.gid === entry.gid) split.value = project.value && project.value.gid !== entry.gid ? project.value : null
  const changed = entry.gid !== project.value?.gid || view.value !== 'board'
  project.value = entry
  writeSetting('project', entry)
  view.value = 'board'
  if (changed) pushPage()
}

function showView(target: View): void {
  if (view.value === target) return
  view.value = target
  pushPage()
}

function openSidebarSearch(): void {
  settings.sidebarOpen = true
  setTimeout(() => sidebar.value?.focusSearch())
}

function onLinkClick(event: MouseEvent): void {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
  const target = event.target as HTMLElement
  if (target instanceof HTMLImageElement && target.closest('.rich, .tile') && !target.closest('[contenteditable="true"]')) {
    event.preventDefault()
    event.stopPropagation()
    lightbox.open(target.currentSrc || target.src, target.alt)
    return
  }
  const link = (event.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
  if (!link || link.hasAttribute('data-external')) return
  const own = `${window.location.origin}${window.location.pathname}#/`
  if (link.href.startsWith(own)) {
    event.preventDefault()
    event.stopPropagation()
    window.location.hash = link.href.slice(own.length - 2)
    return
  }
  const gid =
    link.dataset.asanaType === 'task' && link.dataset.asanaGid ? link.dataset.asanaGid : asanaTaskGid(link.href)
  if (!gid) return
  event.preventDefault()
  event.stopPropagation()
  opener.push(gid)
}

const INTERACTIVE =
  '.card, .row, .task, .cell, .group, .tab, button, a, input, select, textarea, label, [role="button"], [contenteditable], .panel, .popover, .menu, header'

function onMainClick(event: MouseEvent): void {
  if (!settings.dockedPanel || layout.split || !opener.state.gid) return
  if ((event.target as HTMLElement).closest(INTERACTIVE)) return
  opener.close()
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(
    el &&
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el.isContentEditable),
  )
}

function onKey(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (commandOpen.value) closeCommand()
    else commandOpen.value = true
  } else if (event.key === 'Escape' && activityOpen.value && !opener.state.gid && !isTyping(event.target)) {
    activityOpen.value = false
  } else if (event.key === 'Escape' && hotkeysOpen.value) {
    event.stopPropagation()
    hotkeysOpen.value = false
  } else if (me.value && event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target)) {
    event.preventDefault()
    hotkeysOpen.value = !hotkeysOpen.value
  } else if (me.value && event.key.toLowerCase() === 'n' && (event.altKey || (event.shiftKey && !isTyping(event.target)))) {
    event.preventDefault()
    createTask.open()
  } else if (event.key === 'Escape' && opener.state.gid && !commandOpen.value) {
    const target = event.target as HTMLElement
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !target.isContentEditable) {
      opener.close()
    }
  }
}

onMounted(() => {
  if (!needsToken.value) void connect()
  window.addEventListener('keydown', onKey)
  window.addEventListener('popstate', onPopState)
  document.addEventListener('mousedown', onActivityOutside, true)
  document.addEventListener('click', onLinkClick, true)
  try {
    const existing = window.history.state as NavState | null
    if (existing && typeof existing === 'object' && 'view' in existing) applyHistory(existing)
    else if (parseHash(window.location.hash)) void applyHash()
    else window.history.replaceState(navState(), '', hashOf(navState()) || window.location.pathname)
  } catch (e) {
    console.warn('history init failed', e)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('popstate', onPopState)
  document.removeEventListener('mousedown', onActivityOutside, true)
  document.removeEventListener('click', onLinkClick, true)
})
</script>

<template>
  <TokenSetup v-if="needsToken" :error="tokenError" @save="saveToken" />

  <div v-else-if="me && workspace" class="app">
    <AppSidebar
      ref="sidebar"
      :me="me"
      :workspace="workspace"
      :project="project"
      :view="view"
      @pick="pickProject"
      @split="openSplit"
      @workspace="pickWorkspace"
      @my-tasks="showView('my')"
      :activity-open="activityOpen"
      @activity="activityOpen = !activityOpen"
      @command-bar="commandOpen = true"
      @hotkeys="hotkeysOpen = true"
      @sign-out="signOut"
    />

    <main class="main" @click="onMainClick">
      <MyTasksView v-if="view === 'my'" :key="workspace" :me="me" :workspace="workspace" />
      <div
        v-else-if="project && split && splitShown"
        ref="panes"
        class="panes"
        :style="{ gridTemplateColumns: `minmax(0, ${splitRatio}fr) 10px minmax(0, ${1 - splitRatio}fr)` }"
      >
        <BoardView
          :key="`${project.gid}:${settings.showCompleted}:${boardKey}`"
          :project="project"
          :me="me"
          :workspace="workspace"
          :show-completed="settings.showCompleted"
          split
          :active="activePane === 'main'"
          @activate="activePane = 'main'"
          @close="closePane('main')"
        />
        <div class="divider" title="Drag to resize" @pointerdown="startResize" />
        <BoardView
          :key="`${split.gid}:${settings.showCompleted}:${boardKey}`"
          :project="split"
          :me="me"
          :workspace="workspace"
          :show-completed="settings.showCompleted"
          split
          :active="activePane === 'split'"
          @activate="activePane = 'split'"
          @close="closePane('split')"
        />
      </div>
      <BoardView
        v-else-if="project"
        :key="`${project.gid}:${settings.showCompleted}:${boardKey}`"
        :project="project"
        :me="me"
        :workspace="workspace"
        :show-completed="settings.showCompleted"
      />
      <div v-else class="empty panel">
        <ProjectIcon :project="{ gid: '', name: '', color: null, icon: 'board' }" :size="40" />
        <h2>No project open</h2>
        <p>Pick one in the sidebar, or search all projects.</p>
        <button class="btn-primary" @click="openSidebarSearch">Search projects</button>
      </div>
    </main>

    <Transition name="pop">
      <div
        v-if="activityOpen"
        class="activity-anchor"
        :style="{ left: settings.sidebarOpen ? '256px' : '72px' }"
      >
        <div ref="activityPop" class="activity-pop panel">
          <ActivityView @close="activityOpen = false" />
        </div>
      </div>
    </Transition>

    <Transition name="drawer">
      <TaskDrawer v-if="opener.state.gid" :gid="opener.state.gid" @updated="opener.notify($event)" />
    </Transition>

    <Transition name="pop">
      <CreateTaskDialog v-if="createTask.state.open" :project="view === 'board' ? project : null" />
    </Transition>

    <Transition name="pop">
      <CommandBar
        v-if="commandOpen"
        :workspace="workspace"
        :initial="commandInitial"
        @close="closeCommand"
        @open-task="opener.open($event)"
        @open-project="pickProject"
        @my-tasks="showView('my')"
        @activity="activityOpen = true"
        @refresh="boardKey++"
      @hotkeys="hotkeysOpen = true"
        @sign-out="signOut"
      />
    </Transition>
  </div>

  <p v-else class="loading">{{ connectError ? `${connectError} Retrying…` : 'Connecting…' }}</p>

  <Transition name="pop">
    <HotkeysDialog v-if="hotkeysOpen" @close="hotkeysOpen = false" />
  </Transition>
  <Transition name="pop">
    <ImageLightbox v-if="lightbox.state.src" />
  </Transition>
  <ToastHost />
  <DialogHost />

  <ProjectColorMenu
    v-if="colorMenu.state.project"
    :project="colorMenu.state.project"
    :x="colorMenu.state.x"
    :y="colorMenu.state.y"
    @close="colorMenu.close()"
  />
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.panes {
  flex: 1;
  min-height: 0;
  display: grid;
  padding: 0 14px 6px;
}
.panes > * {
  min-height: 0;
}
.divider {
  cursor: col-resize;
  position: relative;
}
.divider::after {
  content: '';
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 4px;
  width: 2px;
  border-radius: 2px;
  background: var(--border);
}
.divider:hover::after {
  background: var(--accent);
}
.activity-anchor {
  position: fixed;
  top: 8px;
  bottom: 8px;
  z-index: 34;
  width: min(520px, calc(100vw - 96px));
  display: flex;
  pointer-events: none;
}
.activity-pop {
  flex: 1;
  min-height: 0;
  display: flex;
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  pointer-events: auto;
}
.empty {
  margin: auto;
  padding: 36px 44px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.empty h2 {
  margin: 8px 0 0;
  font-size: 18px;
}
.empty p {
  margin: 0 0 8px;
}
.loading {
  text-align: center;
  margin-top: 80px;
  color: var(--muted);
}
</style>
