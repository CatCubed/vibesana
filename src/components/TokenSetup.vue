<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ save: [token: string] }>()
defineProps<{ error: string | null }>()

const token = ref('')
</script>

<template>
  <form class="setup panel" @submit.prevent="token.trim() && emit('save', token.trim())">
    <h1>Connect to Asana</h1>
    <ol>
      <li>
        Open
        <a href="https://app.asana.com/0/my-apps" target="_blank" rel="noopener">Asana → My apps</a>
        and create a <strong>personal access token</strong>.
      </li>
      <li>Paste it below. It is stored only in this browser.</li>
    </ol>
    <input v-model="token" type="password" placeholder="Personal access token" autofocus />
    <p v-if="error" class="error">{{ error }}</p>
    <button type="submit" class="btn-primary" :disabled="!token.trim()">Connect</button>
  </form>
</template>

<style scoped>
.setup {
  max-width: 460px;
  margin: 80px auto;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h1 {
  font-size: 22px;
  margin: 0;
}
ol {
  color: var(--muted);
  line-height: calc(1.6 * var(--text-scale));
  padding-left: 20px;
}
a {
  color: var(--accent);
}
.error {
  color: var(--danger);
  margin: 0;
}
button {
  align-self: flex-start;
}
</style>
