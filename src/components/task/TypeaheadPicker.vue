<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import { onMounted, ref, watch } from 'vue'
import * as api from '../../api/asana'
import { useBoardContext } from '../../context'
import { useDismiss } from '../../layers'
import { sideFor, type Side } from '../../popup'
import AvatarBadge from '../AvatarBadge.vue'
import ProjectIcon from '../ProjectIcon.vue'
import type { TypeaheadResult } from '../../types'

const props = defineProps<{ type: 'user' | 'task' | 'project'; placeholder: string }>()
const emit = defineEmits<{ pick: [item: TypeaheadResult]; close: [] }>()

const { workspace, me } = useBoardContext()
const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const results = ref<TypeaheadResult[]>([])
const active = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined

// Mounted only while open: Escape and a click outside both close it.
useDismiss(root, ref(true), () => emit('close'))
const side = ref<Side>('left')

async function search(): Promise<void> {
  try {
    const found = await api.typeahead(workspace, props.type, query.value.trim())
    results.value =
      props.type === 'user' && !query.value.trim()
        ? [me as TypeaheadResult, ...found.filter((u) => u.gid !== me.gid)]
        : found
    active.value = 0
  } catch {
    results.value = []
  }
}

watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(search, 200)
})
onMounted(() => {
  const anchor = root.value?.parentElement
  if (anchor) side.value = sideFor(anchor, 320, root.value?.classList.contains('right') ? 'right' : 'left')
  input.value?.focus()
  void search()
})

function onKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(active.value + 1, results.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const item = results.value[active.value]
    if (item) emit('pick', item)
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
  }
}
</script>

<template>
  <div ref="root" class="popover popup" :class="`side-${side}`">
    <input ref="input" v-model="query" :placeholder="placeholder" :aria-label="placeholder" @keydown="onKey" />
    <ul>
      <li
        v-for="(item, index) in results"
        :key="item.gid"
        :class="{ active: index === active }"
        @mouseenter="active = index"
        @mousedown.prevent="emit('pick', item)"
      >
        <AvatarBadge v-if="type === 'user'" :person="item" :size="22" />
        <ProjectIcon
          v-else-if="type === 'project'"
          :project="{ gid: item.gid, name: item.name, color: item.color ?? null, icon: item.icon ?? null }"
          :size="20"
        />
        <span v-else class="state"><UiIcon :name="item.completed ? 'check-circle' : 'circle'" :size="15" /></span>
        <span class="label">{{ item.name }}</span>
        <span v-if="type === 'user' && item.gid === me.gid" class="muted">(you)</span>
      </li>
      <li v-if="!results.length" class="muted empty">No matches</li>
    </ul>
  </div>
</template>

<style scoped>
.popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  width: 320px;
  padding: 6px;
}
.popover.side-right {
  left: auto;
  right: 0;
}
input {
  width: 100%;
}
ul {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
}
li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
li.active {
  background: var(--chip);
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.state {
  color: var(--muted);
  width: 16px;
  text-align: center;
}
.muted {
  color: var(--muted);
}
.empty {
  cursor: default;
}
</style>
