<script setup lang="ts">
import { computed } from 'vue'
import AvatarBadge from '../AvatarBadge.vue'
import ProjectIcon from '../ProjectIcon.vue'
import UiIcon from '../UiIcon.vue'
import type { Suggestion } from '../../composables/useSuggestions'

/** The list under the caret offering people, tasks and projects to mention, or emoji. */
const props = defineProps<{ items: Suggestion[]; active: number; anchor: { left: number; top: number; bottom: number } }>()
const emit = defineEmits<{ pick: [item: Suggestion] }>()

const HEADINGS = { user: 'People', task: 'Tasks', project: 'Projects', emoji: 'Emoji' } as const

const place = computed(() => {
  const height = Math.min(320, props.items.length * 34 + 60)
  const above = props.anchor.bottom + height + 8 > window.innerHeight && props.anchor.top - height - 8 > 0
  return {
    left: `${Math.max(8, Math.min(props.anchor.left, window.innerWidth - 328))}px`,
    top: above ? undefined : `${props.anchor.bottom + 6}px`,
    bottom: above ? `${window.innerHeight - props.anchor.top + 6}px` : undefined,
  }
})

function where(item: Suggestion): string {
  if (item.kind !== 'task') return ''
  const place = item.item.memberships?.[0]
  return item.item.parent?.name ?? place?.project.name ?? ''
}
</script>

<template>
  <Teleport to="body">
    <ul v-if="items.length" class="suggestion-list popup" role="listbox" aria-label="Suggestions" data-layer :style="place">
      <template v-for="(item, index) in items" :key="item.key">
        <li v-if="item.kind !== items[index - 1]?.kind" class="heading" role="presentation">{{ HEADINGS[item.kind] }}</li>
        <!-- mousedown, not click: the editor must keep its focus and caret -->
        <li class="row" :class="{ active: index === active }" role="option" :aria-selected="index === active" @mousedown.prevent="emit('pick', item)">
          <span v-if="item.kind === 'emoji'" class="emoji">{{ item.emoji }}</span>
          <AvatarBadge v-else-if="item.kind === 'user'" :person="item.item" :size="20" />
          <ProjectIcon
            v-else-if="item.kind === 'project'"
            :project="{ gid: item.item.gid, name: item.item.name, color: item.item.color ?? null, icon: item.item.icon ?? null }"
            :size="18"
          />
          <UiIcon v-else :name="item.item.completed ? 'check-circle' : 'circle'" :size="16" />
          <span class="label">{{ item.label }}</span>
          <span v-if="where(item)" class="where">{{ where(item) }}</span>
        </li>
      </template>
    </ul>
  </Teleport>
</template>

<style>
.suggestion-list {
  position: fixed;
  z-index: 300;
  width: 320px;
  max-height: 320px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 4px;
  font-size: 13px;
}
.suggestion-list .heading {
  padding: 6px 8px 2px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.suggestion-list .row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.suggestion-list .row.active {
  background: var(--chip);
}
.suggestion-list .row .ui-icon {
  color: var(--muted);
}
.suggestion-list .emoji {
  width: 20px;
  text-align: center;
  font-size: 16px;
}
.suggestion-list .label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.suggestion-list .where {
  margin-left: auto;
  flex: none;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--muted);
}
</style>
