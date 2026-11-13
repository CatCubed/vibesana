<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useDialog } from '../composables/useDialog'
import { pushLayer } from '../layers'
import { trapTarget } from '../composables/useFocusTrap'

const dialog = useDialog()
const panel = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const text = ref('')
let previous: HTMLElement | null = null
let removeLayer: (() => void) | null = null

watch(
  () => dialog.state.current,
  async (request) => {
    removeLayer?.()
    removeLayer = null
    if (!request) {
      if (previous?.isConnected) previous.focus()
      previous = null
      return
    }
    previous ??= document.activeElement as HTMLElement | null
    text.value = request.value ?? ''
    removeLayer = pushLayer(() => dialog.settle(null))
    await nextTick()
    if (request.kind === 'prompt') {
      input.value?.focus()
      input.value?.select()
    } else {
      confirmButton.value?.focus()
    }
  },
)

function confirm(): void {
  const request = dialog.state.current
  if (!request) return
  if (request.kind === 'confirm') return dialog.settle('')
  const value = text.value.trim()
  if (value || request.allowEmpty) dialog.settle(value)
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault()
    confirm()
  } else if (event.key === 'Tab' && panel.value) {
    const target = trapTarget(panel.value, document.activeElement, event.shiftKey)
    if (target) {
      event.preventDefault()
      target.focus()
    }
  }
  event.stopPropagation()
}
</script>

<template>
  <Transition name="pop">
    <div v-if="dialog.state.current" class="backdrop" data-layer @mousedown.self="dialog.settle(null)">
      <div
        ref="panel"
        class="dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        @keydown="onKey"
      >
        <h2 id="app-dialog-title">{{ dialog.state.current.title }}</h2>
        <p v-if="dialog.state.current.message" class="message">{{ dialog.state.current.message }}</p>
        <input
          v-if="dialog.state.current.kind === 'prompt'"
          ref="input"
          v-model="text"
          :placeholder="dialog.state.current.placeholder"
          :aria-label="dialog.state.current.title"
        />
        <div class="actions">
          <button class="btn-ghost" @click="dialog.settle(null)">Cancel</button>
          <button
            ref="confirmButton"
            :class="dialog.state.current.danger ? 'btn-danger' : 'btn-primary'"
            :disabled="dialog.state.current.kind === 'prompt' && !dialog.state.current.allowEmpty && !text.trim()"
            @click="confirm"
          >
            {{ dialog.state.current.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--backdrop);
}
.dialog {
  width: min(420px, 100%);
  padding: 18px 18px 14px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}
h2 {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.message {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}
input {
  width: 100%;
  margin-top: 8px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.actions button {
  padding: 6px 16px;
  font-size: 13px;
}
</style>
