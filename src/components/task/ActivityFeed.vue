<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import { useDialog } from '../../composables/useDialog'
import { computed, ref } from 'vue'
import * as api from '../../api/asana'
import { renderRichText } from '../../richtext'
import RichEditor from './RichEditor.vue'
import { useBoardContext } from '../../context'
import { relativeTime } from '../../time'
import { withoutAuthor } from '../../text'
import AvatarBadge from '../AvatarBadge.vue'
import type { Story } from '../../types'

const props = defineProps<{ stories: Story[]; images?: Map<string, string> }>()
const emit = defineEmits<{ remove: [gid: string]; error: [message: string] }>()

const context = useBoardContext()
const editing = ref<string | null>(null)
const busy = ref(false)

function startEdit(story: Story): void {
  editing.value = story.gid
}

async function saveEdit(story: Story, xml: string): Promise<void> {
  if (busy.value) return
  if (xml === '<body></body>') {
    editing.value = null
    return
  }
  busy.value = true
  try {
    Object.assign(story, await api.updateComment(story.gid, xml))
    editing.value = null
  } catch (e) {
    emit('error', (e as Error).message)
  } finally {
    busy.value = false
  }
}

async function remove(story: Story): Promise<void> {
  if (!(await useDialog().confirm({ title: 'Delete this comment?', confirmLabel: 'Delete', danger: true }))) return
  try {
    await api.deleteComment(story.gid)
    emit('remove', story.gid)
  } catch (e) {
    emit('error', (e as Error).message)
  }
}

type Entry =
  | { kind: 'comment'; story: Story; html: string }
  | { kind: 'system'; story: Story }
  | { kind: 'collapsed'; key: string; count: number }

const tab = ref<'comments' | 'all'>('all')
const newestFirst = ref(false)
const expanded = ref(false)

const entries = computed<Entry[]>(() => {
  const list = props.stories.filter((s) => tab.value === 'all' || s.type === 'comment')
  const result: Entry[] = []
  let run: Story[] = []

  const flush = () => {
    const keep = expanded.value || run.length <= 3 ? run : run.slice(-2)
    const hidden = run.length - keep.length
    if (hidden > 0) result.push({ kind: 'collapsed', key: `c-${run[0].gid}`, count: hidden })
    for (const story of keep) result.push({ kind: 'system', story })
    run = []
  }

  list.forEach((story, index) => {
    if (story.type === 'comment') {
      if (run.length) flush()
      result.push({ kind: 'comment', story, html: renderRichText(story.html_text, props.images) || escapeHtml(story.text) })
    } else if (index === 0) {
      result.push({ kind: 'system', story })
    } else {
      run.push(story)
    }
  })
  if (run.length) flush()
  return newestFirst.value ? result.reverse() : result
})

async function toggleLike(story: Story): Promise<void> {
  const next = !story.liked
  story.liked = next
  story.num_likes += next ? 1 : -1
  try {
    await api.likeStory(story.gid, next)
  } catch {
    story.liked = !next
    story.num_likes += next ? -1 : 1
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
</script>

<template>
  <section class="activity">
    <div class="tabs">
      <button :class="{ on: tab === 'comments' }" @click="tab = 'comments'">Comments</button>
      <button :class="{ on: tab === 'all' }" @click="tab = 'all'">All activity</button>
      <button class="sort" @click="newestFirst = !newestFirst"><UiIcon name="sort" :size="14" /> {{ newestFirst ? 'Newest' : 'Oldest' }}</button>
    </div>

    <template v-for="entry in entries" :key="entry.kind === 'collapsed' ? entry.key : entry.story.gid">
      <button v-if="entry.kind === 'collapsed'" class="more" @click="expanded = true">
        Show {{ entry.count }} previous updates
      </button>
      <div v-else-if="entry.kind === 'system'" class="system">
        <strong>{{ entry.story.created_by?.name ?? 'Asana' }}</strong>
        {{ withoutAuthor(entry.story.text, entry.story.created_by?.name) }} · <span class="when">{{ relativeTime(entry.story.created_at) }}</span>
      </div>
      <div v-else class="comment">
        <AvatarBadge :person="entry.story.created_by" :size="28" />
        <div class="body">
          <div class="who">
            {{ entry.story.created_by?.name ?? 'Someone' }}
            <span class="when">
              · {{ relativeTime(entry.story.created_at) }}<template v-if="entry.story.is_edited"> · edited</template>
            </span>
            <span v-if="entry.story.created_by?.gid === context.me.gid && editing !== entry.story.gid" class="own">
              <button class="btn-ghost" title="Edit comment" @click="startEdit(entry.story)"><UiIcon name="edit" :size="14" /> Edit</button>
              <button class="btn-ghost danger" title="Delete comment" @click="remove(entry.story)">Delete</button>
            </span>
          </div>
          <RichEditor
            v-if="editing === entry.story.gid"
            class="edit"
            :html="entry.html"
            :busy="busy"
            @save="saveEdit(entry.story, $event)"
            @cancel="editing = null"
          />
          <div v-else class="rich" v-html="entry.html" />
          <button v-if="editing !== entry.story.gid" class="like" :class="{ on: entry.story.liked }" title="Like" @click="toggleLike(entry.story)">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M10 16.5s-6-3.8-6-8a3.3 3.3 0 0 1 6-1.9 3.3 3.3 0 0 1 6 1.9c0 4.2-6 8-6 8z"
                :fill="entry.story.liked ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
            <span v-if="entry.story.num_likes">{{ entry.story.num_likes }}</span>
          </button>
        </div>
      </div>
    </template>
    <p v-if="!entries.length" class="when">No {{ tab === 'comments' ? 'comments' : 'activity' }} yet</p>
  </section>
</template>

<style scoped>
.activity {
  margin-top: 28px;
  border-top: 1px dashed var(--border);
  padding-top: 14px;
}
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}
.tabs button {
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  border-radius: var(--radius-pill);
  padding: 5px 12px;
}
.tabs button.on {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-ring);
}
.tabs .sort {
  margin-left: auto;
}
.system {
  font-size: 13px;
  color: var(--muted);
  padding: 3px 0 3px 38px;
  line-height: calc(1.4 * var(--text-scale));
}
.system strong {
  font-weight: 600;
}
.more {
  margin: 4px 0 4px 38px;
  background: transparent;
  border-color: transparent;
  color: var(--accent);
  font-size: 13px;
  padding: 2px 0;
}
.comment {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}
.body {
  min-width: 0;
  flex: 1;
}
.who {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
}
.when {
  color: var(--muted);
  font-weight: normal;
  font-size: 13px;
}
.who {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.own {
  margin-left: auto;
  display: inline-flex;
  gap: 2px;
  opacity: 0;
}
.comment:hover .own {
  opacity: 1;
}
.own button {
  font-size: 12px;
  padding: 1px 8px;
}
.own .danger:hover {
  color: var(--danger);
}
.edit {
  margin-top: 6px;
}
.like {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 2px 8px 2px 6px;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
}
.like svg {
  width: 14px;
  height: 14px;
}
.like:hover {
  color: var(--danger);
  background: var(--chip);
}
.like.on {
  color: var(--danger);
}
</style>
