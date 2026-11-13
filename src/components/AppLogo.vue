<script setup lang="ts">
/** The glow-board logo drawn from the current theme: the theme's card tone as the tile, the accent as the columns. */
withDefaults(defineProps<{ size?: number }>(), { size: 26 })
</script>

<template>
  <svg class="app-logo" viewBox="0 0 64 64" :width="size" :height="size" aria-hidden="true">
    <defs>
      <filter id="app-logo-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
    </defs>
    <rect class="tile" x="1" y="1" width="62" height="62" rx="14" />
    <g class="glow" filter="url(#app-logo-glow)">
      <rect x="11" y="13" width="11" height="38" rx="3.5" />
      <rect x="26.5" y="13" width="11" height="24" rx="3.5" />
      <rect x="42" y="13" width="11" height="31" rx="3.5" />
    </g>
    <rect class="bar" x="11" y="13" width="11" height="38" rx="3.5" />
    <rect class="bar" x="26.5" y="13" width="11" height="24" rx="3.5" opacity=".7" />
    <rect class="bar" x="42" y="13" width="11" height="31" rx="3.5" opacity=".45" />
  </svg>
</template>

<style scoped>
.app-logo {
  flex: none;
  display: block;
}
.tile {
  fill: var(--card);
  stroke: var(--border-strong);
  stroke-width: 2;
}
.bar,
.glow {
  fill: var(--accent);
}
.glow {
  opacity: 0.55;
}
:root[data-glow='off'] .glow {
  display: none;
}
</style>
