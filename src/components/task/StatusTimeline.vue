<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import { computed, ref } from 'vue'
import { relativeTime } from '../../time'
import type { Story } from '../../types'

const props = defineProps<{ stories: Story[]; createdAt: string }>()

interface Entry {
  gid: string
  label: string
  from: string
  to: string
  stayed: string
  who: string
  when: string
}

const open = ref(false)

function duration(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`
}

const timeline = computed(() => {
  const entries: Entry[] = []
  const lastChange = new Map<string, string>()
  const current = new Map<string, { label: string; value: string; since: string }>()
  for (const story of props.stories) {
    let key: string | null = null
    let label = ''
    let from = ''
    let to = ''
    if (story.resource_subtype === 'enum_custom_field_changed' && story.custom_field) {
      key = `field:${story.custom_field.gid}`
      label = story.custom_field.name
      from = story.old_enum_value?.name ?? '—'
      to = story.new_enum_value?.name ?? '—'
    } else if (story.resource_subtype === 'section_changed' && story.new_section) {
      key = `section:${story.project?.gid ?? ''}`
      label = story.project?.name ? `Column in ${story.project.name}` : 'Column'
      from = story.old_section?.name ?? '—'
      to = story.new_section.name
    } else if (story.resource_subtype === 'marked_complete' || story.resource_subtype === 'marked_incomplete') {
      key = 'completion'
      label = 'Completion'
      from = story.resource_subtype === 'marked_complete' ? 'open' : 'completed'
      to = story.resource_subtype === 'marked_complete' ? 'completed' : 'open'
    }
    if (!key) continue
    const since = lastChange.get(key) ?? props.createdAt
    entries.push({
      gid: story.gid,
      label,
      from,
      to,
      stayed: duration(since, story.created_at),
      who: story.created_by?.name ?? 'Asana',
      when: relativeTime(story.created_at),
    })
    lastChange.set(key, story.created_at)
    current.set(key, { label, value: to, since: story.created_at })
  }
  const now = new Date().toISOString()
  return {
    entries,
    current: [...current.values()].map((c) => ({ ...c, for: duration(c.since, now) })),
  }
})
</script>

<template>
  <section v-if="timeline.entries.length" class="timeline">
    <button class="head" @click="open = !open">
      <span class="caret"><UiIcon :name="open ? 'chevron-down' : 'chevron-right'" :size="13" /></span>
      <span class="eyebrow">Status history</span>
      <span class="badge">{{ timeline.entries.length }}</span>
      <span class="now">
        <span v-for="c in timeline.current" :key="c.label" class="pill" :title="c.label">{{ c.value }} · {{ c.for }}</span>
      </span>
    </button>
    <ol v-if="open">
      <li v-for="entry in timeline.entries" :key="entry.gid">
        <span class="label">{{ entry.label }}</span>
        <span class="change">
          <span class="from">{{ entry.from }}</span>
          <span class="stay" title="Time spent in the previous value">{{ entry.stayed }}</span>
          <span class="arrow">→</span>
          <span class="to">{{ entry.to }}</span>
        </span>
        <span class="meta">{{ entry.who }} · {{ entry.when }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.timeline {
  margin-top: 24px;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: transparent;
  padding: 4px 0;
  text-align: left;
}
.caret {
  width: 10px;
  font-size: 10px;
  color: var(--muted);
}
.now {
  margin-left: auto;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.pill {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
}
ol {
  list-style: none;
  margin: 8px 0 0;
  padding: 0 0 0 14px;
  border-left: 2px solid var(--border);
}
li {
  display: grid;
  grid-template-columns: calc(150px * var(--text-scale)) 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
}
.label {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.change {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.from {
  color: var(--muted);
}
.stay {
  font-size: 11px;
  color: var(--muted);
  background: var(--surface-2);
  border-radius: var(--radius-pill);
  padding: 0 7px;
}
.arrow {
  color: var(--muted);
}
.to {
  font-weight: 700;
  color: var(--text-strong);
}
.meta {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
</style>
