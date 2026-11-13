import { reactive } from 'vue'

/** App-level layout facts that components outside App need to react to. */
const layout = reactive({ split: false })

export function useLayout() {
  return layout
}
