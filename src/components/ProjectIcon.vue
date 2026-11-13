<script setup lang="ts">
import { computed } from 'vue'
import { textOn } from '../colors'
import { projectColor } from '../composables/useSettings'
import type { Project } from '../types'

const props = withDefaults(defineProps<{ project: Project; size?: number }>(), { size: 20 })

const GLYPHS: Record<string, string> = {
  list: 'M5 6h10M5 10h10M5 14h10',
  board: 'M4 4h3v12H4zM8.5 4h3v8h-3zM13 4h3v10h-3z',
  timeline: 'M4 6h7M7 10h8M5 14h6',
  calendar: 'M4 6h12v10H4zM4 9h12M7 4v3M13 4v3',
  people: 'M7.5 9a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM3.5 15c.4-2.4 2-3.6 4-3.6s3.6 1.2 4 3.6M13 9.2a1.9 1.9 0 1 0 0-3.8M13.5 11.6c1.5.3 2.6 1.4 3 3.4',
  code: 'M7.5 6.5L4 10l3.5 3.5M12.5 6.5L16 10l-3.5 3.5M11 5l-2 10',
  gear: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M5 15l1.4-1.4M13.6 6.4L15 5',
  archive: 'M3.5 5h13v3h-13zM4.5 8v7.5h11V8M8 11h4',
  star: 'M10 3.5l2 4.2 4.5.6-3.3 3.1.8 4.5L10 13.7 6 15.9l.8-4.5-3.3-3.1 4.5-.6z',
  rocket: 'M10 3c2.5 1.5 3.5 4 3 7.5l-1.5 2h-3L7 10.5C6.5 7 7.5 4.5 10 3zM8.5 14.5L10 17l1.5-2.5',
  bug: 'M7 8h6v5a3 3 0 0 1-6 0zM8 8a2 2 0 0 1 4 0M4 10h3M13 10h3M4.5 14l2.5-1M15.5 14L13 13',
  check: 'M5 10.5l3 3 7-7',
  target: 'M10 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  globe: 'M10 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM4 10h12M10 4c2 2 2 10 0 12M10 4c-2 2-2 10 0 12',
  light_bulb: 'M7.5 12.5C6 11.5 5.5 10 5.5 8.5a4.5 4.5 0 0 1 9 0c0 1.5-.5 3-2 4v1.5h-5zM8 16.5h4',
  folder: 'M3.5 6h5l1.5 1.5h6.5V15h-13z',
  briefcase: 'M3.5 7h13v8.5h-13zM7.5 7V5h5v2M3.5 10.5h13',
  html: 'M7.5 6.5L4 10l3.5 3.5M12.5 6.5L16 10l-3.5 3.5M11 5l-2 10',
  computer: 'M3.5 5h13v8h-13zM7 16h6M10 13v3',
  graph: 'M4 15l4-5 3 3 5-7M4 16h12',
  chat_bubbles: 'M3.5 5h8v6h-5l-3 2.5zM12 8h4.5v5.5l-2.5-1.5H9',
  notebook: 'M6 3.5h9v13H6zM4 6h2M4 9h2M4 12h2M9 7h3',
  presentation: 'M3.5 4h13v9h-13zM10 13v3M7 16h6',
  megaphone: 'M4 8.5v3h3l6 3.5v-10L7 8.5zM15 9a2 2 0 0 1 0 2',
  bullseye: 'M10 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  puzzle: 'M5 5h4a1.5 1.5 0 1 1 2 0h4v4a1.5 1.5 0 1 0 0 2v4h-4a1.5 1.5 0 1 0-2 0H5v-4a1.5 1.5 0 1 1 0-2z',
  ribbon: 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM7.5 11.5L6 17l4-2 4 2-1.5-5.5',
  coins: 'M7 8a4 1.6 0 1 0 8 0 4 1.6 0 1 0-8 0M7 8v4c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6V8M4.5 11.5a4 1.6 0 0 0 4 1.6',
  mountain_flag: 'M3 16l5-8 3 4 2-3 4 7zM8 8V3h4l-1.5 1.5L12 6H8',
  speed_dial: 'M4 14a6 6 0 1 1 12 0M10 14l3-4',
  shoe: 'M3.5 13h13v2.5h-13zM3.5 13c0-3 3-4 5-5l2.5 2.5h5.5',
  shopping_basket: 'M3.5 8.5h13l-1.5 7h-10zM7 8.5L10 4l3 4.5M7.5 11.5v2M10 11.5v2M12.5 11.5v2',
  ticket: 'M3.5 6h13v3a1.5 1.5 0 0 0 0 3v3h-13v-3a1.5 1.5 0 0 0 0-3zM8 6v9',
  line_and_symbols: 'M4 6h7M4 10h12M4 14h9M15 5l1.5 2.5',
}

const background = computed(() => projectColor(props.project) ?? '#6d6e6f')
const stroke = computed(() => textOn(background.value))
const path = computed(() => GLYPHS[props.project.icon ?? ''] ?? GLYPHS.list)
</script>

<template>
  <span class="project-icon" :style="{ width: `${size}px`, height: `${size}px`, background }">
    <svg viewBox="0 0 20 20" :width="size * 0.8" :height="size * 0.8" aria-hidden="true">
      <path :d="path" fill="none" :stroke="stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
</template>

<style scoped>
.project-icon {
  flex: none;
  display: inline-grid;
  place-items: center;
  border-radius: 5px;
}
</style>
