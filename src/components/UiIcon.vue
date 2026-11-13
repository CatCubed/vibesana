<script setup lang="ts">
const ICONS = {
  like: 'M7 9l3-6c1.2 0 2 .8 2 2v3h3.2c1 0 1.7.9 1.5 1.9l-1 4.6c-.2.9-1 1.5-1.9 1.5H7zM7 9H4v7h3',
  link: 'M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1',
  pin: 'M11.5 3.5l5 5-2 .7-2.6 2.6.2 3.2-1.4 1.4-6.6-6.6 1.4-1.4 3.2.2 2.6-2.6zM7.4 12.6L3.5 16.5',
  external: 'M11 4h5v5M16 4l-7 7M14 11v4.5H4.5V6H9',
  more: 'M5 10h.01M10 10h.01M15 10h.01',
  expand: 'M4 8V4h4M16 12v4h-4M4 4l5 5M16 16l-5-5',
  shrink: 'M9 5v4H5M11 15v-4h4M9 9L4 4M11 11l5 5',
  close: 'M5 5l10 10M15 5L5 15',
  back: 'M9 5l-5 5 5 5M4 10h12',
  check: 'M4.5 10.5l3.5 3.5 7.5-8',
  split: 'M3.5 4.5h13v11h-13zM10 4.5v11',
  hourglass: 'M5.5 3.5h9M5.5 16.5h9M7 3.5v2.8L10 10l3-3.7V3.5M7 16.5v-2.8L10 10l3 3.7v2.8',
  'chevron-down': 'M5 7.5l5 5 5-5',
  'chevron-right': 'M7.5 5l5 5-5 5',
  'chevron-left': 'M12.5 5l-5 5 5 5',
  grip: 'M7.5 5h.01M12.5 5h.01M7.5 10h.01M12.5 10h.01M7.5 15h.01M12.5 15h.01',
  edit: 'M4 16l.8-3.6 8.4-8.4a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3L7.6 15.2zM11.8 5.4l2.8 2.8',
  user: 'M10 10a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM4 16.5c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5',
  circle: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z',
  'check-circle': 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM7 10.2l2.1 2.1 4-4.3',
  undo: 'M7.5 4.5L4 8l3.5 3.5M4 8h7.5a4.5 4.5 0 0 1 0 9H9',
  redo: 'M12.5 4.5L16 8l-3.5 3.5M16 8H8.5a4.5 4.5 0 0 0 0 9H11',
  quote: 'M4.5 13.5v-3a4 4 0 0 1 4-4M11.5 13.5v-3a4 4 0 0 1 4-4M4.5 10.5h3v3h-3zM11.5 10.5h3v3h-3z',
  'code-block': 'M3.5 4.5h13v11h-13zM8 8l-2 2 2 2M12 8l2 2-2 2',
  code: 'M7 6l-4 4 4 4M13 6l4 4-4 4',
  paragraph: 'M13 4v12M10 4v12M14.5 4H8.5a3.5 3.5 0 0 0 0 7H10',
  bullets: 'M4 6h.01M4 10h.01M4 14h.01M8 6h8M8 10h8M8 14h8',
  numbers: 'M8 6h8M8 10h8M8 14h8M3.5 5l1-.7V8M3.5 12.2c.3-.5 1.6-.6 1.6.3 0 .7-1.6 1.2-1.6 2h1.8',
  send: 'M10 16V4M5 9l5-5 5 5',
  sort: 'M6 4v12M3.5 13.5L6 16l2.5-2.5M14 16V4M11.5 6.5L14 4l2.5 2.5',
  plus: 'M10 4v12M4 10h12',
  refresh: 'M15.5 8A6 6 0 0 0 4.6 6.5M4.5 3.5v3h3M4.5 12a6 6 0 0 0 10.9 1.5M15.5 16.5v-3h-3',
  'chevrons-left': 'M10 5l-5 5 5 5M15 5l-5 5 5 5',
  'chevrons-right': 'M5 5l5 5-5 5M10 5l5 5-5 5',
  trash: 'M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6M8.5 9v4M11.5 9v4',
} as const

withDefaults(defineProps<{ name: keyof typeof ICONS; size?: number }>(), { size: 18 })
</script>

<template>
  <svg class="ui-icon" :class="name" viewBox="0 0 20 20" :width="size" :height="size" aria-hidden="true">
    <path :d="ICONS[name]" />
  </svg>
</template>

<style scoped>
.ui-icon {
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  vertical-align: middle;
}
.ui-icon.more {
  stroke-width: 2.8;
}
.ui-icon.grip,
.ui-icon.bullets {
  stroke-width: 2.2;
}
</style>
