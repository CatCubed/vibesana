<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, ref } from 'vue'
import { renderRichText } from '../richtext'
import { relativeTime } from '../time'
import { withoutAuthor } from '../text'
import { asanaColor, textOn } from '../colors'
import { projectColor } from '../composables/useSettings'
import { useActivity } from '../composables/useActivity'
import { useTaskOpener } from '../composables/useTaskOpener'
import AvatarBadge from './AvatarBadge.vue'
import type { Colored, Story } from '../types'

type Tab = 'all' | 'comments' | 'mentions' | 'new'
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'comments', label: 'Comments' },
  { value: 'mentions', label: 'Mentions' },
]
const PREVIEW = 4

const emit = defineEmits<{ close: [] }>()
const activity = useActivity()
const opener = useTaskOpener()
const tab = ref<Tab>('all')
const expanded = ref(new Set<string>())

function mentionsMe(story: Story): boolean {
  return Boolean(story.html_text?.includes(`data-asana-gid="${activity.state.me}"`))
}

function isNew(story: Story): boolean {
  return activity.isNew(story)
}

function markGroupRead(gid: string): void {
  const group = activity.state.groups.find((g) => g.task.gid === gid)
  if (group) activity.markRead(group.stories.filter(isNew).map((s) => s.gid))
}

function matches(story: Story): boolean {
  if (tab.value === 'comments') return story.type === 'comment'
  if (tab.value === 'mentions') return mentionsMe(story)
  if (tab.value === 'new') return isNew(story)
  return true
}

const groups = computed(() =>
  activity.state.groups
    .map((group) => {
      const stories = group.stories.filter(matches)
      const open = expanded.value.has(group.task.gid)
      return {
        task: group.task,
        latest: stories[stories.length - 1]?.created_at ?? group.latest,
        hidden: open ? 0 : Math.max(0, stories.length - PREVIEW),
        stories: open ? stories : stories.slice(-PREVIEW),
        fresh: stories.some(isNew),
      }
    })
    .filter((group) => group.stories.length),
)

function expand(gid: string): void {
  expanded.value = new Set(expanded.value).add(gid)
}

function chipStyle(project: Colored): Record<string, string> {
  const hex = projectColor(project) ?? asanaColor(project.color)
  return hex ? { background: hex, color: textOn(hex) } : {}
}

function commentHtml(story: Story): string {
  return renderRichText(story.html_text) || story.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
}
</script>

<template>
  <div class="activity">
    <header class="head">
      <h1>Activity</h1>
      <span v-if="activity.newCount.value" class="badge lit">{{ activity.newCount.value }} new</span>
      <div class="tabs">
        <button v-for="t in TABS" :key="t.value" :class="{ on: tab === t.value }" @click="tab = t.value">{{ t.label }}</button>
      </div>
      <span class="spacer" />
      <button class="pill" :disabled="!activity.newCount.value" @click="activity.markAllRead()"><UiIcon name="check" :size="14" /> Mark all read</button>
      <button class="btn-ghost round" title="Refresh" :disabled="activity.state.loading" @click="activity.refresh()">
        <span :class="{ spin: activity.state.loading }"><UiIcon name="refresh" :size="15" /></span>
      </button>
      <button class="close" title="Close (Esc)" aria-label="Close (Esc)" @click="emit('close')"><UiIcon name="close" :size="14" /></button>
    </header>
    <p v-if="activity.state.error" class="error">{{ activity.state.error }}</p>
    <p class="hint" title="Not Asana's Inbox: what counts as new is tracked in this browser only.">
      Last 14 days, on tasks you're assigned to or following.
    </p>

    <div class="list">
      <article v-for="group in groups" :key="group.task.gid" class="group panel" :class="{ fresh: group.fresh }">
        <header class="task" @click="opener.open(group.task.gid)">
          <span class="state" :class="{ done: group.task.completed }"><UiIcon :name="group.task.completed ? 'check-circle' : 'circle'" :size="15" /></span>
          <span class="name">{{ group.task.name || 'Untitled task' }}</span>
          <span v-for="p in group.task.projects" :key="p.gid" class="project" :style="chipStyle(p)">{{ p.name }}</span>
          <span class="when">{{ relativeTime(group.latest) }}</span>
          <button v-if="group.fresh" class="read-btn" title="Mark this task's updates as read" @click.stop="markGroupRead(group.task.gid)">
            <UiIcon name="check" :size="14" /> Read
          </button>
        </header>
        <button v-if="group.hidden" class="more" @click="expand(group.task.gid)">Show {{ group.hidden }} earlier updates</button>
        <div
          v-for="story in group.stories"
          :key="story.gid"
          class="story"
          :class="{ comment: story.type === 'comment', fresh: isNew(story) }"
        >
          <button
            v-if="isNew(story)"
            class="dot"
            title="New — click to mark as read"
            @click.stop="activity.markRead([story.gid])"
          />
          <template v-if="story.type === 'comment'">
            <AvatarBadge :person="story.created_by" :size="26" />
            <div class="body">
              <div class="who">
                {{ story.created_by?.name ?? 'Someone' }}
                <span v-if="mentionsMe(story)" class="mention">mentioned you</span>
                <span class="when">· {{ relativeTime(story.created_at) }}</span>
              </div>
              <div class="rich" v-html="commentHtml(story)" />
            </div>
          </template>
          <div v-else class="system">
            <strong>{{ story.created_by?.name ?? 'Asana' }}</strong> {{ withoutAuthor(story.text, story.created_by?.name) }}
            <span class="when">· {{ relativeTime(story.created_at) }}</span>
          </div>
        </div>
      </article>

      <div v-if="!groups.length" class="empty">
        <div v-if="activity.state.loading" class="sk-groups" aria-label="Loading activity">
          <div v-for="n in 3" :key="n" class="panel sk-group">
            <div class="skeleton" :style="{ height: '15px', width: `${[55, 40, 62][n - 1]}%` }" />
            <div class="skeleton" style="height: 12px; width: 80%" />
            <div class="skeleton" style="height: 12px; width: 66%" />
          </div>
        </div>
        <p v-else>{{ tab === 'all' ? 'Nothing happened in the last 14 days.' : 'Nothing matches this filter.' }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  flex: 1;
}
h1 {
  font-size: 17px !important;
}
.hint {
  margin: 0 16px 8px !important;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 6px 16px;
  flex-wrap: wrap;
}
.close {
  background: transparent;
  color: var(--muted);
  padding: 4px 8px;
}
.close:hover {
  color: var(--text-strong);
}
h1 {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
}
.badge.lit {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
  padding: 0 8px;
}
.tabs {
  display: flex;
  margin-left: 10px;
  background: var(--surface);
  border-radius: var(--radius-pill);
  padding: 3px;
  box-shadow: var(--shadow-raised);
}
.tabs button {
  background: transparent;
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  font-size: 13px;
  color: var(--muted);
}
.tabs button.on {
  background: var(--accent);
  color: var(--accent-contrast);
}
.spacer {
  flex: 1;
}
.pill {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-raised);
  font-size: 13px;
  color: var(--muted);
}
.pill:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-soft);
}
.round {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  padding: 0;
  font-size: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-raised);
}
.spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.hint,
.error {
  margin: 0 20px 8px;
  font-size: 12px;
  color: var(--muted);
}
.error {
  color: var(--danger);
}
.list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.group {
  padding: 4px 12px 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  box-shadow: none;
}
.group.fresh {
  border-color: var(--accent-ring);
  box-shadow: var(--shadow-raised), var(--glow);
}
.task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  cursor: pointer;
  border-bottom: 1px dashed var(--border);
  margin-bottom: 6px;
}
.task:hover .name {
  color: var(--accent);
}
.state {
  color: var(--muted);
  font-weight: 800;
}
.state.done {
  color: var(--ok);
}
.name {
  font-weight: 800;
  color: var(--text-strong);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project {
  font-size: 11px;
  font-weight: 800;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--chip);
  white-space: nowrap;
}
.when {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  white-space: nowrap;
}
.more {
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  padding: 2px 0 2px 18px;
}
.story {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 5px 0 5px 18px;
}
.dot {
  position: absolute;
  left: 0;
  top: 12px;
  width: 11px;
  height: 11px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--surface);
  cursor: pointer;
}
.dot:hover {
  transform: scale(1.3);
}
.read-btn {
  flex: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}
.read-btn:hover {
  background: var(--accent-soft);
}
.story.fresh .dot {
  background: var(--accent);
  box-shadow: var(--glow);
}
.body {
  min-width: 0;
  flex: 1;
}
.who {
  font-weight: 700;
  font-size: 13px;
}
.mention {
  font-size: 11px;
  font-weight: 800;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-pill);
  padding: 0 7px;
  margin-left: 4px;
}
.system {
  font-size: 13px;
  color: var(--muted);
  line-height: calc(1.45 * var(--text-scale));
}
.system strong {
  color: var(--text);
  font-weight: 700;
}
.empty {
  margin-top: 60px;
  color: var(--muted);
  width: min(860px, 100%);
}
.empty:has(.sk-groups) {
  margin-top: 0;
}
.sk-group {
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
