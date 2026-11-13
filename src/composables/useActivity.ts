import { computed, reactive } from 'vue'
import { useConnection } from './useConnection'
import * as api from '../api/asana'
import { readCache, writeCache } from '../cache'
import { readSetting, writeSetting } from '../settings'
import { useSettings } from './useSettings'
import type { ActivityTask, Story } from '../types'

export interface ActivityGroup {
  task: ActivityTask
  stories: Story[]
  latest: string
}

const WINDOW_DAYS = 14
const MAX_TASKS = 40
const REFRESH_MS = 120_000

interface Cached {
  modified_at: string
  stories: Story[]
}

const state = reactive<{
  groups: ActivityGroup[]
  loading: boolean
  error: string | null
  seen: string
  read: string[]
  me: string
}>({
  read: readSetting<string[]>('activity-read', []),
  groups: [],
  loading: false,
  error: null,
  seen: readSetting('activity-seen', new Date(Date.now() - 86_400_000).toISOString()),
  me: '',
})

let workspace = ''
let notifiedUntil = new Date().toISOString()
let onNotificationClick: (() => void) | null = null

function notify(): void {
  const settings = useSettings()
  const fresh = state.groups
    .flatMap((g) => g.stories.filter((s) => s.created_at > notifiedUntil).map((story) => ({ story, task: g.task })))
    .sort((a, b) => a.story.created_at.localeCompare(b.story.created_at))
  if (!fresh.length) return
  notifiedUntil = fresh[fresh.length - 1].story.created_at
  if (!settings.notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible' && document.hasFocus()) return
  const last = fresh[fresh.length - 1]
  const title = fresh.length > 1 ? `Vibesana: ${fresh.length} new updates` : (last.task.name || 'Vibesana')
  const body = `${last.story.created_by?.name ?? 'Someone'}: ${last.story.text}`.slice(0, 180)
  try {
    const notification = new Notification(title, { body, tag: 'vibesana-activity', icon: '/icon.svg' })
    notification.onclick = () => {
      window.focus()
      onNotificationClick?.()
      notification.close()
    }
  } catch {
    /* notifications unavailable */
  }
}
let timer: ReturnType<typeof setInterval> | undefined
let storyCache = new Map<string, Cached>()

function isNew(story: { gid: string; created_at: string }): boolean {
  return story.created_at > state.seen && !state.read.includes(story.gid)
}

const newCount = computed(() => state.groups.reduce((n, g) => n + g.stories.filter(isNew).length, 0))

function markRead(gids: string[]): void {
  const next = new Set(state.read)
  for (const gid of gids) next.add(gid)
  state.read = [...next].slice(-2000)
  writeSetting('activity-read', state.read)
}

function build(tasks: ActivityTask[]): void {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
  const groups: ActivityGroup[] = []
  for (const task of tasks) {
    const stories = (storyCache.get(task.gid)?.stories ?? []).filter(
      (s) => s.created_at >= since && s.created_by !== null && s.created_by.gid !== state.me,
    )
    if (stories.length) groups.push({ task, stories, latest: stories[stories.length - 1].created_at })
  }
  groups.sort((a, b) => b.latest.localeCompare(a.latest))
  state.groups = groups
}

async function refresh(): Promise<void> {
  if (!workspace || state.loading) return
  state.loading = true
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
    const tasks = (await api.activityTasks(workspace, state.me, since)).slice(0, MAX_TASKS)
    const stale = tasks.filter((t) => storyCache.get(t.gid)?.modified_at !== t.modified_at)
    for (let i = 0; i < stale.length; i += 6) {
      await Promise.all(
        stale.slice(i, i + 6).map(async (task) => {
          try {
            storyCache.set(task.gid, { modified_at: task.modified_at, stories: await api.stories(task.gid) })
          } catch {
            /* a task we can no longer read — skip it */
          }
        }),
      )
    }
    const keep = new Set(tasks.map((t) => t.gid))
    for (const gid of [...storyCache.keys()]) if (!keep.has(gid)) storyCache.delete(gid)
    build(tasks)
    notify()
    state.error = null
    void writeCache(`activity:${workspace}`, { tasks, stories: [...storyCache.entries()] })
    useConnection().succeeded()
  } catch (e) {
    useConnection().failed(e)
    state.error =
      e instanceof api.AsanaError && e.status === 402
        ? "Activity needs Asana's search API, which is only available on paid plans."
        : (e as Error).message
  } finally {
    state.loading = false
  }
}

async function start(ws: string, me: string): Promise<void> {
  if (ws === workspace && me === state.me) return
  stop()
  workspace = ws
  state.me = me
  state.groups = []
  storyCache = new Map()
  const cached = await readCache<{ tasks: ActivityTask[]; stories: [string, Cached][] }>(`activity:${ws}`)
  if (cached) {
    storyCache = new Map(cached.stories)
    build(cached.tasks)
  }
  void refresh()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' || useSettings().notifications) void refresh()
  }, REFRESH_MS)
}

function stop(): void {
  clearInterval(timer)
  workspace = ''
}

function markAllRead(): void {
  state.seen = new Date().toISOString()
  state.read = []
  writeSetting('activity-read', state.read)
  writeSetting('activity-seen', state.seen)
}

async function enableNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  return permission === 'granted'
}

export function useActivity() {
  return {
    state,
    newCount,
    start,
    stop,
    refresh,
    markAllRead,
    markRead,
    isNew,
    enableNotifications,
    onNotificationClick: (fn: () => void) => {
      onNotificationClick = fn
    },
  }
}
