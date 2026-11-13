<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import { useDialog } from '../../composables/useDialog'
import { ref } from 'vue'
import type { Attachment } from '../../types'

defineProps<{ attachments: Attachment[]; uploading: boolean }>()
const emit = defineEmits<{ upload: [files: File[]]; remove: [attachment: Attachment] }>()

const input = ref<HTMLInputElement | null>(null)
const over = ref(false)

const IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i

function onFiles(list: FileList | null | undefined): void {
  const files = Array.from(list ?? [])
  if (files.length) emit('upload', files)
}

function onDrop(event: DragEvent): void {
  over.value = false
  onFiles(event.dataTransfer?.files)
}

async function confirmRemove(attachment: Attachment): Promise<void> {
  const sure = await useDialog().confirm({ title: 'Delete this attachment?', message: attachment.name, confirmLabel: 'Delete', danger: true })
  if (sure) emit('remove', attachment)
}
</script>

<template>
  <section
    class="attachments"
    :class="{ over }"
    @dragover.prevent="over = true"
    @dragleave.self="over = false"
    @drop.prevent="onDrop"
  >
    <h3>
      Attachments
      <button class="ghost" title="Upload files" @click="input?.click()">+</button>
      <span v-if="uploading" class="muted">Uploading…</span>
    </h3>
    <input ref="input" type="file" multiple hidden @change="onFiles(($event.target as HTMLInputElement).files)" />
    <div v-if="attachments.length" class="grid">
      <div v-for="file in attachments" :key="file.gid" class="tile">
        <a :href="file.view_url ?? file.download_url ?? '#'" target="_blank" rel="noopener noreferrer">
          <img v-if="IMAGE.test(file.name) && file.download_url" :src="file.download_url" :alt="file.name" loading="lazy" />
          <span v-else class="file">{{ file.name.split('.').pop()?.toUpperCase() }}</span>
          <span class="name">{{ file.name }}</span>
        </a>
        <button class="remove" title="Delete attachment" aria-label="Delete attachment" @click="confirmRemove(file)"><UiIcon name="close" :size="14" /></button>
      </div>
    </div>
    <p v-else class="muted drop">Drop files here or use +</p>
  </section>
</template>

<style scoped>
.attachments {
  border-radius: 8px;
  border: 1px dashed transparent;
}
.attachments.over {
  border-color: var(--accent);
}
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 28px 0 8px;
}
.ghost {
  background: transparent;
  border-color: transparent;
  color: var(--muted);
  padding: 0 6px;
  font-size: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}
.tile {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.tile a {
  display: flex;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
}
.tile img,
.file {
  height: 90px;
  width: 100%;
  object-fit: cover;
  background: var(--chip);
}
.file {
  display: grid;
  place-items: center;
  font-weight: 600;
  color: var(--muted);
}
.name {
  font-size: 12px;
  padding: 4px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.remove {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 0 6px;
  font-size: 11px;
  opacity: 0;
}
.tile:hover .remove {
  opacity: 1;
}
.muted {
  color: var(--muted);
  font-size: 13px;
  font-weight: normal;
}
.drop {
  margin: 0;
}
</style>
