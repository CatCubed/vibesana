<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { onBeforeUnmount, onMounted } from 'vue'
import { useToasts } from '../composables/useToasts'

const toasts = useToasts()

onMounted(() => window.addEventListener('beforeunload', toasts.flush))
onBeforeUnmount(() => window.removeEventListener('beforeunload', toasts.flush))
</script>

<template>
  <TransitionGroup tag="div" name="toast" class="host" aria-live="polite">
    <div v-for="toast in toasts.state.list" :key="toast.id" class="toast panel" :class="toast.kind">
      <span class="icon"><UiIcon v-if="toast.kind === 'success'" name="check" :size="13" /><template v-else>{{ toast.kind === 'error' ? '!' : 'i' }}</template></span>
      <span class="text">{{ toast.text }}</span>
      <button v-if="toast.actionLabel" class="action" @click="toasts.act(toast.id)">{{ toast.actionLabel }}</button>
      <button class="close" title="Dismiss" aria-label="Dismiss" @click="toasts.dismiss(toast.id)"><UiIcon name="close" :size="14" /></button>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.host {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(640px, calc(100vw - 32px));
  --tone: var(--accent);
  padding: 10px 10px 10px 14px;
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
  box-shadow:
    var(--shadow-float),
    0 0 22px color-mix(in srgb, var(--tone) 38%, transparent);
  font-size: 14px;
  font-weight: 700;
}
.toast.error {
  --tone: var(--danger);
}
.toast.success {
  --tone: var(--ok);
}
:root[data-glow='off'] .toast {
  box-shadow: var(--shadow-float);
}
.icon {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  background: color-mix(in srgb, var(--tone) 20%, transparent);
  color: var(--tone);
}
.error .icon {
  background: var(--danger);
  color: var(--danger-contrast);
}
.success .icon {
  background: var(--ok);
  color: var(--ok-contrast);
}
.text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.action {
  flex: none;
  background: var(--accent);
  color: var(--accent-contrast);
  border-radius: var(--radius-pill);
  padding: 3px 12px;
  font-size: 12px;
}
.close {
  flex: none;
  background: transparent;
  color: var(--muted);
  padding: 2px 6px;
  font-size: 11px;
}
</style>
