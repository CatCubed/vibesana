<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import * as api from '../api/asana'
import { readCache, writeCache } from '../cache'
import { readSetting, writeSetting } from '../settings'
import { useClickOutside } from '../composables/useClickOutside'
import {
  ACCENTS,
  activePalette,
  COLUMN_WIDTHS,
  FONT_SIZES,
  type FontSize,
  FONTS,
  useSettings,
  type Accent,
  type ColumnWidth,
  type Density,
  type Font,
  type Indicator,
  type Theme,
} from '../composables/useSettings'
import { useActivity } from '../composables/useActivity'
import { useColorMenu } from '../composables/useColorMenu'
import { useTaskOpener } from '../composables/useTaskOpener'
import { useTaskShortcuts, type TaskRef } from '../composables/useTaskShortcuts'
import { useCreateTask } from '../composables/useCreateTask'
import { useToasts } from '../composables/useToasts'
import AvatarBadge from './AvatarBadge.vue'
import UiIcon from './UiIcon.vue'
import AppLogo from './AppLogo.vue'
import SelectMenu from './SelectMenu.vue'
import { textOn } from '../colors'
import { DARK_PALETTES, LIGHT_PALETTES } from '../themes'
import ProjectIcon from './ProjectIcon.vue'
import ProjectRow from './ProjectRow.vue'
import type { Named, Person, Project } from '../types'

const props = defineProps<{
  me: Person & { workspaces: Named[] }
  workspace: string
  project: Project | null
  view: 'board' | 'my' | 'activity'
  activityOpen?: boolean
}>()

const emit = defineEmits<{
  pick: [project: Project, newTab: boolean]
  split: [project: Project]
  workspace: [gid: string]
  'my-tasks': []
  activity: []
  'command-bar': []
  hotkeys: []
  'sign-out': []
}>()

const settings = useSettings()
const colorMenu = useColorMenu()
const opener = useTaskOpener()
const shortcuts = useTaskShortcuts()
const recentUnpinned = computed<TaskRef[]>(() => shortcuts.state.recent.filter((t) => !shortcuts.isPinned(t.gid)))
const createTask = useCreateTask()
const activity = useActivity()
const favorites = ref<Project[]>([])
const work = ref<Project[]>([])
const workLoading = ref(false)
const order = ref<string[]>([])
const sectionsOpen = ref({
  starred: true,
  work: true,
  pinned: true,
  recent: true,
  ...readSetting<Record<string, boolean>>('sidebar-sections', {}),
})
const query = ref('')
const results = ref<Project[]>([])
const error = ref<string | null>(null)
const toasts = useToasts()
watch(error, (message) => {
  if (!message) return
  toasts.error(message)
  error.value = null
})
const searchInput = ref<HTMLInputElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

// Compact sidebar: hovering it shows the full sidebar on top of the page until the pointer leaves.
const peek = ref(false)
let hovered = false
let peekTimer: ReturnType<typeof setTimeout> | undefined
const open = computed(() => settings.sidebarOpen || peek.value)

function onEnter(): void {
  hovered = true
  clearTimeout(peekTimer)
  if (settings.sidebarOpen) return
  peekTimer = setTimeout(() => (peek.value = true), 140)
}

function onLeave(): void {
  hovered = false
  clearTimeout(peekTimer)
  peekTimer = setTimeout(() => {
    if (!hovered && !menuOpen.value && !colorMenu.state.project) peek.value = false
  }, 280)
}

watch(
  () => [settings.sidebarOpen, menuOpen.value, colorMenu.state.project] as const,
  ([pinned, menu, picking]) => {
    if (pinned || (!hovered && !menu && !picking)) peek.value = false
  },
)
const dragging = ref<string | null>(null)
const dropTarget = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

useClickOutside(menu, () => (menuOpen.value = false))

const THEMES: Theme[] = ['system', 'light', 'dark']
const DENSITIES: Density[] = ['comfortable', 'compact']
const WIDTHS: { value: ColumnWidth; label: string }[] = [
  { value: 'narrow', label: 'S' },
  { value: 'normal', label: 'M' },
  { value: 'wide', label: 'L' },
  { value: 'xwide', label: 'XL' },
]
const TEXT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'normal', label: 'M' },
  { value: 'large', label: 'L' },
  { value: 'xlarge', label: 'XL' },
]
const DARK_OPTIONS = DARK_PALETTES.map((p) => ({ value: p.id, label: p.label }))
const LIGHT_OPTIONS = LIGHT_PALETTES.map((p) => ({ value: p.id, label: p.label }))
const FONT_GROUPS = { sans: 'Sans', mono: 'Monospace', system: 'Other' } as const
const FONT_OPTIONS = (Object.keys(FONTS) as Font[])
  .map((key) => ({ value: key as string, label: FONTS[key].label, group: FONT_GROUPS[FONTS[key].kind] }))
  .sort((a, b) => Object.values(FONT_GROUPS).indexOf(a.group) - Object.values(FONT_GROUPS).indexOf(b.group))
const INDICATORS: { value: Indicator; label: string }[] = [
  { value: 'chip', label: 'Chip' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'Off' },
]

const orderKey = computed(() => `work-order:${props.workspace}`)

const sortedWork = computed(() => {
  const rank = new Map(order.value.map((gid, index) => [gid, index]))
  return [...work.value].sort((a, b) => {
    const ra = rank.get(a.gid) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.gid) ?? Number.MAX_SAFE_INTEGER
    return ra !== rb ? ra - rb : a.name.localeCompare(b.name)
  })
})

const railProjects = computed(() => {
  const seen = new Set<string>()
  return [...favorites.value, ...sortedWork.value].filter((p) => !seen.has(p.gid) && seen.add(p.gid)).slice(0, 12)
})

async function loadFavorites(): Promise<void> {
  try {
    favorites.value = await api.favoriteProjects(props.workspace)
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function loadWork(): Promise<void> {
  const key = `work:${props.workspace}`
  const cached = await readCache<Project[]>(key)
  if (cached) work.value = cached
  workLoading.value = true
  try {
    work.value = await api.myProjects(props.workspace, props.me.gid)
    void writeCache(key, work.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    workLoading.value = false
  }
}

function loadAll(): void {
  error.value = null
  order.value = readSetting<string[]>(orderKey.value, [])
  void loadFavorites()
  void loadWork()
}

onMounted(loadAll)
watch(() => props.workspace, loadAll)

watch(query, (value) => {
  clearTimeout(timer)
  if (!value.trim()) {
    results.value = []
    return
  }
  timer = setTimeout(async () => {
    try {
      results.value = await api.searchProjects(props.workspace, value.trim())
    } catch (e) {
      error.value = (e as Error).message
    }
  }, 200)
})

function canSplit(item: Project): boolean {
  return props.view === 'board' && props.project !== null && item.gid !== props.project.gid
}

function pick(project: Project, newTab = false): void {
  query.value = ''
  emit('pick', project, newTab)
}

function pickCustomAccent(event: Event): void {
  settings.accentCustom = (event.target as HTMLInputElement).value
  settings.accent = 'custom'
}

async function toggleNotifications(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  if (!input.checked) {
    settings.notifications = false
    return
  }
  const granted = await activity.enableNotifications()
  settings.notifications = granted
  input.checked = granted
  if (!granted) toasts.error('The browser blocked notifications for this page. Allow them in the site settings.')
}

function toggleSection(name: 'starred' | 'work' | 'pinned' | 'recent'): void {
  sectionsOpen.value = { ...sectionsOpen.value, [name]: !sectionsOpen.value[name] }
  writeSetting('sidebar-sections', sectionsOpen.value)
}

function onDrop(target: string): void {
  const source = dragging.value
  dragging.value = null
  dropTarget.value = null
  if (!source || source === target) return
  const gids = sortedWork.value.map((p) => p.gid).filter((gid) => gid !== source)
  gids.splice(gids.indexOf(target), 0, source)
  order.value = gids
  writeSetting(orderKey.value, gids)
}

function resetOrder(): void {
  order.value = []
  writeSetting(orderKey.value, [])
}

function focusSearch(): void {
  settings.sidebarOpen = true
  setTimeout(() => searchInput.value?.focus())
}

defineExpose({ focusSearch })
</script>

<template>
  <div class="sidebar-slot" :class="{ rail: !settings.sidebarOpen }" @mouseenter="onEnter" @mouseleave="onLeave">
  <aside class="sidebar" :class="{ rail: !open, peek: peek && !settings.sidebarOpen }">
    <div class="brand">
      <AppLogo :size="28" />
      <span v-if="open" class="brand-name">Vibesana</span>
      <button
        class="btn-ghost toggle"
        :title="settings.sidebarOpen ? 'Collapse sidebar (it opens when you hover it)' : 'Keep the sidebar open'"
        @click="settings.sidebarOpen = !settings.sidebarOpen"
      >
        <UiIcon :name="settings.sidebarOpen ? 'chevrons-left' : 'chevrons-right'" :size="16" />
      </button>
    </div>

    <template v-if="open">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input
          ref="searchInput"
          v-model="query"
          class="search"
          placeholder="Search projects"
          @keydown.esc="query = ''"
          @keydown.enter="results[0] && pick(results[0])"
        />
        <kbd title="Command bar" @click="emit('command-bar')">Ctrl K</kbd>
      </div>

      <button class="new-task btn-primary" title="New task (Shift+N)" @click="createTask.open()">+ New task</button>

      <nav class="scroll">
        <button class="nav-item" :class="{ active: view === 'my' }" @click="emit('my-tasks')">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.8" />
            <path d="M6.8 10.2l2.2 2.2 4.4-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          My Tasks
        </button>
        <button class="nav-item second" data-activity-toggle :class="{ active: activityOpen }" @click="emit('activity')">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 14V9a4.5 4.5 0 0 1 9 0v5l1.5 1.5h-12zM8.5 17h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Activity
          <span v-if="activity.newCount.value" class="count">{{ activity.newCount.value }}</span>
        </button>
        <template v-if="query.trim()">
          <h4 class="eyebrow static">Results</h4>
          <ProjectRow
            v-for="item in results"
            :key="item.gid"
            :item="item"
            :active="item.gid === project?.gid"
            :can-split="canSplit(item)"
            @pick="pick(item, $event)"
            @split="emit('split', item)"
          />
          <p v-if="!results.length" class="muted">No matches</p>
        </template>

        <template v-else>
          <h4 class="eyebrow" @click="toggleSection('starred')">
            <span class="caret"><UiIcon :name="sectionsOpen.starred ? 'chevron-down' : 'chevron-right'" :size="13" /></span> Starred
          </h4>
          <template v-if="sectionsOpen.starred">
            <ProjectRow
              v-for="item in favorites"
              :key="item.gid"
              :item="item"
              :active="item.gid === project?.gid"
              :can-split="canSplit(item)"
              @pick="pick(item, $event)"
              @split="emit('split', item)"
            />
            <p v-if="!favorites.length" class="muted">Star projects in Asana to pin them here.</p>
          </template>

          <h4 class="eyebrow" @click="toggleSection('work')">
            <span class="caret"><UiIcon :name="sectionsOpen.work ? 'chevron-down' : 'chevron-right'" :size="13" /></span> Work
            <span v-if="workLoading" class="spinner" title="Refreshing"><UiIcon name="refresh" :size="15" /></span>
            <span v-else class="badge">{{ work.length }}</span>
          </h4>
          <template v-if="sectionsOpen.work">
            <ProjectRow
              v-for="item in sortedWork"
              :key="item.gid"
              :item="item"
              :active="item.gid === project?.gid"
              :can-split="canSplit(item)"
              draggable
              :drop="dropTarget === item.gid"
              :ghosted="dragging === item.gid"
              @pick="pick(item, $event)"
              @split="emit('split', item)"
              @dragstart="dragging = item.gid"
              @dragend="dragging = null; dropTarget = null"
              @dragover="dropTarget = item.gid"
              @drop="onDrop(item.gid)"
            />
            <p v-if="!work.length && !workLoading" class="muted">You're not a member of any project.</p>
          </template>
        </template>
      </nav>

      <!-- Task shortcuts live in their own block under the projects, so the two never mix. -->
      <section v-if="!query.trim() && (shortcuts.state.pinned.length || recentUnpinned.length)" class="tasks-dock" aria-label="Task shortcuts">
        <div class="dock-scroll">
          <template v-if="shortcuts.state.pinned.length">
            <h4 class="eyebrow" @click="toggleSection('pinned')">
              <span class="caret"><UiIcon :name="sectionsOpen.pinned ? 'chevron-down' : 'chevron-right'" :size="13" /></span> Pinned
            </h4>
            <template v-if="sectionsOpen.pinned">
              <div
                v-for="item in shortcuts.state.pinned"
                :key="item.gid"
                class="task-row"
                :class="{ active: opener.state.gid === item.gid, done: item.completed }"
                role="button"
                tabindex="0"
                :title="item.name"
                @click="opener.open(item.gid)"
                @keydown.enter="opener.open(item.gid)"
              >
                <span class="task-state"><UiIcon :name="item.completed ? 'check-circle' : 'circle'" :size="15" /></span>
                <span class="task-name">{{ item.name || 'Untitled task' }}</span>
                <button class="task-pin on" title="Unpin" aria-label="Unpin" @click.stop="shortcuts.togglePin(item)"><UiIcon name="pin" :size="14" /></button>
              </div>
            </template>
          </template>
          <template v-if="recentUnpinned.length">
            <h4 class="eyebrow" @click="toggleSection('recent')">
              <span class="caret"><UiIcon :name="sectionsOpen.recent ? 'chevron-down' : 'chevron-right'" :size="13" /></span> Recent
              <button class="clear-recent" title="Clear recent tasks" @click.stop="shortcuts.clearRecent()">Clear</button>
            </h4>
            <template v-if="sectionsOpen.recent">
              <div
                v-for="item in recentUnpinned"
                :key="item.gid"
                class="task-row"
                :class="{ active: opener.state.gid === item.gid, done: item.completed }"
                role="button"
                tabindex="0"
                :title="item.name"
                @click="opener.open(item.gid)"
                @keydown.enter="opener.open(item.gid)"
              >
                <span class="task-state"><UiIcon :name="item.completed ? 'check-circle' : 'circle'" :size="15" /></span>
                <span class="task-name">{{ item.name || 'Untitled task' }}</span>
                <button class="task-pin" title="Pin to the sidebar" aria-label="Pin to the sidebar" @click.stop="shortcuts.togglePin(item)"><UiIcon name="pin" :size="14" /></button>
              </div>
            </template>
          </template>
        </div>
      </section>
    </template>

    <nav v-else class="scroll rail-list">
      <button class="rail-item nav-rail new-rail" title="New task (Shift+N)" @click="createTask.open()">+</button>
      <button class="rail-item nav-rail" :class="{ active: view === 'my' }" title="My Tasks" @click="emit('my-tasks')">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M6.8 10.2l2.2 2.2 4.4-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
      <button class="rail-item nav-rail" data-activity-toggle :class="{ active: activityOpen }" title="Activity" @click="emit('activity')">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 14V9a4.5 4.5 0 0 1 9 0v5l1.5 1.5h-12zM8.5 17h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <i v-if="activity.newCount.value" class="rail-dot" />
      </button>
      <button
        v-for="item in railProjects"
        :key="item.gid"
        class="rail-item"
        :class="{ active: item.gid === project?.gid }"
        :title="item.name"
        @click="pick(item)"
        @contextmenu.prevent="colorMenu.open(item, $event)"
      >
        <ProjectIcon :project="item" :size="30" />
      </button>
    </nav>

    <footer ref="menu" class="account">
      <div v-if="menuOpen" class="menu panel">
        <div class="menu-head">
          <AvatarBadge :person="me" :size="34" />
          <div class="menu-who">
            <strong>{{ me.name }}</strong>
            <SelectMenu
              v-if="me.workspaces.length > 1"
              compact
              label="Workspace"
              :model-value="workspace"
              :options="me.workspaces.map((w) => ({ value: w.gid, label: w.name }))"
              @update:model-value="emit('workspace', $event)"
            />
            <span v-else class="muted">{{ me.workspaces[0]?.name }}</span>
          </div>
        </div>

        <h5 class="eyebrow">Appearance</h5>
        <div class="row">
          <span>Theme</span>
          <div class="segmented">
            <button v-for="t in THEMES" :key="t" :class="{ on: settings.theme === t }" @click="settings.theme = t">
              {{ t }}
            </button>
          </div>
        </div>
        <div class="row">
          <span>Dark theme</span>
          <SelectMenu v-model="settings.darkPalette" compact label="Dark theme" :options="DARK_OPTIONS" />
        </div>
        <div class="row">
          <span>Light theme</span>
          <SelectMenu v-model="settings.lightPalette" compact label="Light theme" :options="LIGHT_OPTIONS" />
        </div>
        <div class="row accent-row">
          <span>Accent</span>
          <div class="swatches">
            <button
              class="swatch theme-swatch"
              :class="{ on: settings.accent === 'theme' }"
              :style="{ background: activePalette().accent, color: activePalette().accent }"
              title="The current theme's own colour"
              @click="settings.accent = 'theme'"
            >
              <span :style="{ color: textOn(activePalette().accent) }">T</span>
            </button>
            <button
              v-for="(hex, name) in ACCENTS"
              :key="name"
              class="swatch"
              :class="{ on: settings.accent === name }"
              :style="{ background: hex, color: hex }"
              :title="name"
              @click="settings.accent = name as Accent"
            />
            <label
              class="swatch custom"
              :class="{ on: settings.accent === 'custom' }"
              :style="settings.accent === 'custom' ? { background: settings.accentCustom, color: settings.accentCustom } : undefined"
              title="Custom colour"
            >
              <input type="color" :value="settings.accentCustom" @input="pickCustomAccent" @click="settings.accent = 'custom'" />
            </label>
          </div>
        </div>
        <div class="row">
          <span>Font</span>
          <SelectMenu
            compact
            label="Font"
            :model-value="settings.font"
            :options="FONT_OPTIONS"
            @update:model-value="settings.font = $event as Font"
          />
        </div>
        <div class="row">
          <span>Text size</span>
          <div class="segmented">
            <button
              v-for="s in TEXT_SIZES"
              :key="s.value"
              :class="{ on: settings.fontSize === s.value }"
              :title="`${Math.round(FONT_SIZES[s.value] * 100)}%`"
              @click="settings.fontSize = s.value"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
        <div class="row">
          <span>Density</span>
          <div class="segmented">
            <button
              v-for="d in DENSITIES"
              :key="d"
              :class="{ on: settings.density === d }"
              @click="settings.density = d"
            >
              {{ d }}
            </button>
          </div>
        </div>
        <label class="row">
          <span>Glow</span>
          <input v-model="settings.glow" type="checkbox" class="switch" />
        </label>

        <label class="row">
          <span>Animations</span>
          <input v-model="settings.animations" type="checkbox" class="switch" />
        </label>

        <h5 class="eyebrow">Board</h5>
        <div class="row">
          <span>Column width</span>
          <div class="segmented">
            <button
              v-for="w in WIDTHS"
              :key="w.value"
              :class="{ on: settings.columnWidth === w.value }"
              :title="`${COLUMN_WIDTHS[w.value]}px`"
              @click="settings.columnWidth = w.value"
            >
              {{ w.label }}
            </button>
          </div>
        </div>
        <div class="row">
          <span>Project indicator</span>
          <div class="segmented">
            <button
              v-for="i in INDICATORS"
              :key="i.value"
              :class="{ on: settings.indicator === i.value }"
              @click="settings.indicator = i.value"
            >
              {{ i.label }}
            </button>
          </div>
        </div>
        <p class="tip">Hover a project and click the palette, or use the color dot in a task, to pick its color.</p>
        <label class="row">
          <span>Show completed tasks</span>
          <input v-model="settings.showCompleted" type="checkbox" class="switch" />
        </label>
        <label class="row" title="On: the task opens beside the board, which stays usable. Off: it opens over a dimmed board.">
          <span>Dock task panel</span>
          <input v-model="settings.dockedPanel" type="checkbox" class="switch" />
        </label>
        <label class="row" title="Shows a desktop notification for new Activity items while Vibesana is in the background">
          <span>Desktop notifications</span>
          <input :checked="settings.notifications" type="checkbox" class="switch" @change="toggleNotifications" />
        </label>
        <button class="row action" @click="emit('hotkeys'); menuOpen = false">Keyboard shortcuts <kbd class="menu-kbd">?</kbd></button>
        <button class="row action" @click="resetOrder">Reset project order</button>
        <button class="row action danger" @click="emit('sign-out')">Sign out</button>
      </div>

      <button class="account-button" :title="open ? '' : me.name" @click="menuOpen = !menuOpen">
        <AvatarBadge :person="me" :size="28" />
        <template v-if="open">
          <span class="name">{{ me.name }}</span>
          <span class="gear">⚙</span>
        </template>
      </button>
    </footer>
  </aside>
  </div>
</template>

<style scoped>
.sidebar-slot {
  position: relative;
  flex: none;
  width: 248px;
  display: flex;
  min-height: 0;
  transition: width 0.15s;
}
.sidebar-slot.rail {
  width: 64px;
}
.sidebar {
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  min-height: 0;
}
.sidebar.rail {
  align-items: center;
}
.sidebar.peek {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 248px;
  z-index: 35;
  box-shadow: var(--shadow-float);
  animation: peek-in 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes peek-in {
  from {
    width: 64px;
    opacity: 0.6;
  }
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 10px 10px 14px;
  width: 100%;
}
.sidebar.rail .brand {
  flex-direction: column;
  padding: 12px 0 6px;
  gap: 4px;
}
.brand-name {
  font-weight: 800;
  font-size: 17px;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}
.toggle {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 15px;
}
.sidebar.rail .toggle {
  margin: 0;
}
.search-wrap {
  position: relative;
  margin: 2px 12px 8px;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.search {
  width: 100%;
  padding-left: 32px;
  padding-right: 54px;
  border-radius: var(--radius-pill);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 4px 0 6px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: transparent;
  font-weight: 700;
  color: var(--text);
  text-align: left;
}
.new-task {
  margin: 0 12px 8px;
  padding: 7px 12px;
  border-radius: var(--radius-pill);
  font-size: 13px;
}
.rail-item.new-rail,
.rail-item.new-rail:hover {
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 20px;
  font-weight: 700;
  box-shadow: var(--glow);
}
.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 4px 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.task-row:hover {
  background: var(--chip);
}
.task-row.active {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
.task-row.done .task-name {
  color: var(--muted);
  text-decoration: line-through;
}
.task-state {
  flex: none;
  width: 14px;
  text-align: center;
  color: var(--muted);
}
.task-row.done .task-state {
  color: var(--ok);
}
.task-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-pin {
  flex: none;
  display: grid;
  place-items: center;
  background: transparent;
  padding: 2px 4px;
  color: var(--muted);
  opacity: 0;
}
.task-row:hover .task-pin {
  opacity: 1;
}
.task-pin.on {
  opacity: 1;
  color: var(--accent);
}
.task-pin.on :deep(svg) {
  fill: color-mix(in srgb, var(--accent) 22%, transparent);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 70%, transparent));
}
:root[data-glow='off'] .task-pin.on :deep(svg) {
  filter: none;
}
.task-pin:hover {
  color: var(--text-strong);
  background: var(--surface);
}
.clear-recent {
  margin-left: auto;
  background: transparent;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
  color: var(--muted);
  opacity: 0;
}
h4:hover .clear-recent {
  opacity: 1;
}
.menu-kbd {
  position: static;
  transform: none;
  margin-left: auto;
  cursor: default;
}
.nav-item.second {
  margin-top: -2px;
}
.nav-item .count {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 11px;
  font-weight: 800;
  box-shadow: var(--glow);
}
.nav-item.active .count {
  background: var(--accent-contrast);
  color: var(--accent);
  box-shadow: none;
}
.nav-rail {
  position: relative;
}
.rail-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: var(--glow);
}
.nav-item svg {
  width: 18px;
  height: 18px;
  color: var(--muted);
}
.nav-item:hover {
  background: var(--chip);
}
.nav-item.active {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
}
.nav-item.active svg {
  color: var(--accent-contrast);
}
.nav-rail {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  color: var(--muted);
  margin-bottom: 6px;
}
.nav-rail svg {
  width: 20px;
  height: 20px;
}
.nav-rail.active {
  background: var(--accent);
  color: var(--accent-contrast);
}
kbd {
  cursor: pointer;
  pointer-events: auto;
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font: 700 10px var(--font);
  font-size-adjust: var(--font-adjust);
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 5px;
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 2px 8px 12px;
  width: 100%;
}
.tasks-dock {
  flex: none;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 40%;
  min-height: 0;
  padding: 0 8px 6px;
  border-top: 1px solid var(--border);
}
.dock-scroll {
  overflow-y: auto;
  min-height: 0;
}
h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px 6px 4px;
  cursor: pointer;
  user-select: none;
}
h4.static {
  cursor: default;
}
h4:hover:not(.static) {
  color: var(--text);
}
h4 .badge {
  margin-left: auto;
  height: 16px;
  min-width: 16px;
  font-size: 10px;
}
.caret {
  width: 10px;
  font-size: 10px;
}
.spinner {
  margin-left: auto;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.rail-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
}
.rail-item {
  padding: 3px;
  background: transparent;
  border-radius: 9px;
  display: flex;
}
.rail-item.active {
  background: var(--accent);
  box-shadow: var(--glow);
}
.rail-item.nav-rail {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  line-height: 1;
}
.muted {
  color: var(--muted);
  font-size: 12px;
  margin: 4px 8px;
}
.error {
  color: var(--danger);
  font-size: 12px;
  margin: 8px;
  cursor: pointer;
}
.account {
  position: relative;
  width: 100%;
  border-top: 1px solid var(--border);
  padding: 8px;
}
.account-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: transparent;
  padding: 4px 6px;
  text-align: left;
  border-radius: var(--radius-sm);
}
.sidebar.rail .account-button {
  justify-content: center;
  padding: 4px 0;
}
.name {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gear {
  color: var(--muted);
}
.menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 8px;
  width: 300px;
  z-index: 40;
  padding: 10px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}
.menu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 10px;
  border-bottom: 1px solid var(--border);
}
.menu-who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.menu-who strong {
  color: var(--text-strong);
}
.menu-who .muted {
  margin: 0;
}
.workspace,
h5 {
  margin: 12px 6px 4px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px;
  font-size: 13px;
  width: 100%;
  font-weight: 600;
}
.tip {
  margin: 0 6px 4px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}
.action {
  background: transparent;
  text-align: left;
  border-radius: var(--radius-sm);
}
.action:hover {
  background: var(--chip);
}
.danger {
  color: var(--danger);
}
.segmented {
  display: flex;
  background: var(--surface-2);
  border-radius: var(--radius-pill);
  padding: 2px;
  box-shadow: var(--shadow-inset);
}
.segmented button {
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  font-size: 12px;
  padding: 3px 9px;
  text-transform: capitalize;
  color: var(--muted);
}
.segmented button.on {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
}
.accent-row {
  align-items: flex-start;
}
.swatches {
  display: grid;
  grid-template-columns: repeat(8, 20px);
  width: max-content;
  gap: 6px;
  justify-content: end;
}
.theme-swatch {
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}
.theme-swatch span {
  font: 800 11px/1 var(--font);
  font-size-adjust: var(--font-adjust);
}
.swatch.custom {
  position: relative;
  display: block;
  box-sizing: border-box;
  cursor: pointer;
  /* a colour wheel says "any colour" without needing a symbol */
  background: conic-gradient(#f25555, #f5c542, #a3d94a, #2bd4c4, #4f8cff, #9b7bff, #f26fb2, #f25555);
}
.swatch.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  padding: 0;
  cursor: pointer;
}
.swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid transparent;
}
.swatch.on {
  border-color: var(--text-strong);
  box-shadow: 0 0 10px currentColor;
}
.switch {
  appearance: none;
  flex: none;
  /* Inputs get a 1px border from the base styles; here it would push the knob off-centre. */
  border: 0;
  width: 36px;
  height: 20px;
  border-radius: var(--radius-pill);
  background: var(--chip);
  position: relative;
  padding: 0;
  margin: 0;
  cursor: pointer;
}
.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-strong);
  transition: transform 0.15s;
}
.switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.switch:checked {
  background: var(--accent);
  box-shadow: var(--glow);
}
.switch:checked::after {
  transform: translateX(16px);
  background: var(--accent-contrast);
}
</style>
