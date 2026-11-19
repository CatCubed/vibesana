<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '../api/asana'
import UiIcon from './UiIcon.vue'
import { renderRichText } from '../richtext'
import { toResourceLinks, type ResourceLink } from '../overview'

/**
 * Read-only project overview: key resources, description and brief.
 * Nothing here is cached or stored: it may hold credentials, so it is fetched fresh every time it is opened.
 */
const props = defineProps<{ project: string }>()

interface Part<T> {
  loading: boolean
  error: string | null
  value: T
}
const part = <T,>(value: T): Part<T> => ({ loading: true, error: null, value })

const resources = ref(part<ResourceLink[]>([]))
const description = ref(part(''))
const brief = ref(part<{ title: string; html: string } | null>(null))
const loading = computed(() => resources.value.loading || description.value.loading || brief.value.loading)

async function loadResources(): Promise<void> {
  resources.value = part([])
  try {
    resources.value = { loading: false, error: null, value: toResourceLinks(await api.projectResources(props.project)) }
  } catch (e) {
    resources.value = { loading: false, error: (e as Error).message, value: [] }
  }
}

async function loadText(): Promise<void> {
  description.value = part('')
  brief.value = part(null)
  let briefGid: string | null = null
  try {
    const data = await api.projectDescription(props.project)
    description.value = { loading: false, error: null, value: renderRichText(data.html_notes) }
    briefGid = data.brief
  } catch (e) {
    description.value = { loading: false, error: (e as Error).message, value: '' }
  }
  if (!briefGid) {
    brief.value = { loading: false, error: null, value: null }
    return
  }
  try {
    const data = await api.projectBrief(briefGid)
    const html = renderRichText(data.html_text)
    brief.value = { loading: false, error: null, value: html ? { title: data.title, html } : null }
  } catch (e) {
    brief.value = { loading: false, error: (e as Error).message, value: null }
  }
}

function load(): void {
  void loadResources()
  void loadText()
}
onMounted(load)
</script>

<template>
  <div class="overview">
    <div class="inner">
      <div class="bar">
        <span class="note">Read-only. Loaded fresh from Asana each time; nothing here is stored in the browser.</span>
        <button class="btn-ghost round" title="Reload the overview" aria-label="Reload the overview" :disabled="loading" @click="load">
          <UiIcon name="refresh" :size="15" />
        </button>
      </div>

      <section class="panel">
        <h2 class="eyebrow">Key resources</h2>
        <div v-if="resources.loading" class="rows">
          <div v-for="w in [44, 58, 36]" :key="w" class="skeleton" :style="{ height: '18px', width: `${w}%` }" />
        </div>
        <p v-else-if="resources.error" class="quiet">Could not load key resources: {{ resources.error }}</p>
        <p v-else-if="!resources.value.length" class="quiet">No key resources on this project.</p>
        <ul v-else class="resources">
          <li v-for="item in resources.value" :key="item.gid">
            <a :href="item.href" target="_blank" rel="noopener noreferrer" data-external :title="item.href">
              <UiIcon :name="item.kind === 'link' ? 'link' : 'file'" :size="16" />
              <span class="label">{{ item.label }}</span>
              <span class="source">{{ item.source }}</span>
            </a>
          </li>
        </ul>
      </section>

      <section class="panel">
        <h2 class="eyebrow">Description</h2>
        <div v-if="description.loading" class="rows">
          <div v-for="w in [92, 80, 64]" :key="w" class="skeleton" :style="{ height: '13px', width: `${w}%` }" />
        </div>
        <p v-else-if="description.error" class="quiet">Could not load the description: {{ description.error }}</p>
        <!-- renderRichText rebuilds the markup from an allow-list, so this is safe to insert -->
        <div v-else-if="description.value" class="rich" v-html="description.value" />
        <p v-else class="quiet">This project has no description.</p>
      </section>

      <section v-if="brief.loading || brief.error || brief.value" class="panel">
        <h2 class="eyebrow">Project brief</h2>
        <div v-if="brief.loading" class="rows">
          <div v-for="w in [88, 72, 90, 50]" :key="w" class="skeleton" :style="{ height: '13px', width: `${w}%` }" />
        </div>
        <p v-else-if="brief.error" class="quiet">Could not load the project brief: {{ brief.error }}</p>
        <template v-else-if="brief.value">
          <h3 v-if="brief.value.title">{{ brief.value.title }}</h3>
          <div class="rich" v-html="brief.value.html" />
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overview {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 20px 28px;
}
.inner {
  max-width: 920px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.note {
  flex: 1;
  font-size: 12px;
  color: var(--muted);
}
.panel {
  padding: 16px 18px 18px;
  border: 1px solid var(--border);
}
h2 {
  margin: 0 0 12px;
}
h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-strong);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.quiet {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
.resources {
  list-style: none;
  margin: 0 -8px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 2px 10px;
}
.resources a {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  color: var(--text-strong);
  text-decoration: none;
  font-weight: 700;
  line-height: calc(1.35 * var(--text-scale));
}
.resources a:hover {
  background: var(--chip);
}
.resources a :deep(svg) {
  color: var(--accent);
}
.label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source {
  margin-left: auto;
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
</style>
