<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useLightbox } from '../composables/useLightbox'
import { pushLayer } from '../layers'
import { useFocusTrap } from '../composables/useFocusTrap'

const lightbox = useLightbox()
const actual = ref(false)
const size = ref('')

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    lightbox.close()
  }
}

function onLoad(event: Event): void {
  const img = event.target as HTMLImageElement
  size.value = `${img.naturalWidth} × ${img.naturalHeight}`
}

const boxEl = ref<HTMLElement | null>(null)
useFocusTrap(boxEl)
let removeLayer: (() => void) | null = null
onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  removeLayer = pushLayer(() => lightbox.close())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  removeLayer?.()
})
</script>

<template>
  <div ref="boxEl" class="backdrop" role="dialog" aria-modal="true" :aria-label="lightbox.state.alt || 'Image'" @click.self="lightbox.close()">
    <div class="bar">
      <span class="meta">{{ lightbox.state.alt }} <span v-if="size">· {{ size }}</span></span>
      <button @click="actual = !actual">{{ actual ? 'Fit to screen' : 'Actual size' }}</button>
      <a :href="lightbox.state.src ?? '#'" target="_blank" rel="noopener noreferrer" data-external>Open in new tab <UiIcon name="external" :size="14" /></a>
      <button title="Close (Esc)" aria-label="Close (Esc)" @click="lightbox.close()"><UiIcon name="close" :size="14" /></button>
    </div>
    <div class="stage" :class="{ actual }" @click.self="lightbox.close()">
      <img
        :src="lightbox.state.src ?? ''"
        :alt="lightbox.state.alt"
        :title="actual ? 'Click to fit to screen' : 'Click for actual size'"
        @click="actual = !actual"
        @load="onLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgb(5 8 14 / 0.88);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
}
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  color: #dfe5ee;
}
.meta {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}
.bar button,
.bar a {
  background: rgb(255 255 255 / 0.1);
  color: #fff;
  border-radius: var(--radius-pill);
  padding: 5px 14px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.bar button:hover,
.bar a:hover {
  background: rgb(255 255 255 / 0.2);
}
.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px 16px;
  overflow: auto;
}
.stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-sm);
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.6);
  cursor: zoom-in;
}
.stage.actual {
  display: block;
  text-align: center;
}
.stage.actual img {
  max-width: none;
  max-height: none;
  cursor: zoom-out;
}
</style>
