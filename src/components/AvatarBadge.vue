<script setup lang="ts">
import { computed } from 'vue'
import type { Person } from '../types'

const props = withDefaults(defineProps<{ person: Person | null; size?: number }>(), { size: 24 })

const initials = computed(() =>
  (props.person?.name ?? '?')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)
const photo = computed(() => props.person?.photo?.image_27x27 ?? null)
const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.42)}px`,
}))
</script>

<template>
  <img v-if="photo" :src="photo" :alt="person?.name" :title="person?.name" class="avatar" :style="style" />
  <span v-else class="avatar" :title="person?.name" :style="style">{{ initials }}</span>
</template>

<style scoped>
.avatar {
  flex: none;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--text);
  display: inline-grid;
  place-items: center;
  font-weight: 600;
  object-fit: cover;
}
</style>
