import { reactive } from 'vue'
import type { Colored } from '../types'

const state = reactive<{ project: Colored | null; x: number; y: number }>({ project: null, x: 0, y: 0 })

function open(project: Colored, event: MouseEvent): void {
  state.project = { gid: project.gid, name: project.name, color: project.color ?? null }
  state.x = event.clientX
  state.y = event.clientY
}

function close(): void {
  state.project = null
}

export function useColorMenu() {
  return { state, open, close }
}
