import { inject, type InjectionKey } from 'vue'
import type { Person } from './types'

export interface BoardContext {
  workspace: string
  project: string
  me: Person
}

export const boardContextKey: InjectionKey<BoardContext> = Symbol('board-context')

export function useBoardContext(): BoardContext {
  const context = inject(boardContextKey)
  if (!context) throw new Error('Board context missing')
  return context
}
