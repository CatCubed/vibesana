import { reactive } from 'vue'

const state = reactive<{ src: string | null; alt: string }>({ src: null, alt: '' })

export function useLightbox() {
  return {
    state,
    open: (src: string, alt = '') => {
      state.src = src
      state.alt = alt
    },
    close: () => {
      state.src = null
    },
  }
}
