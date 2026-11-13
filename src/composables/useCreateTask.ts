import { reactive } from 'vue'

const state = reactive<{ open: boolean }>({ open: false })

export function useCreateTask() {
  return {
    state,
    open: () => {
      state.open = true
    },
    close: () => {
      state.open = false
    },
  }
}
