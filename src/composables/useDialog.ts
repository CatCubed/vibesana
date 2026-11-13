import { reactive } from 'vue'

export interface DialogRequest {
  kind: 'confirm' | 'prompt'
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  /** Prompt only: the starting text, a placeholder, and whether an empty answer may be confirmed. */
  value?: string
  placeholder?: string
  allowEmpty?: boolean
  resolve: (answer: string | null) => void
}

type Options = Omit<DialogRequest, 'kind' | 'resolve' | 'confirmLabel'> & { confirmLabel?: string }

const state = reactive<{ current: DialogRequest | null }>({ current: null })

function ask(kind: DialogRequest['kind'], options: Options): Promise<string | null> {
  state.current?.resolve(null)
  return new Promise((resolve) => {
    state.current = { kind, confirmLabel: 'OK', ...options, resolve }
  })
}

/** Answers the open dialog: null cancels, a string confirms (the text for a prompt). */
function settle(answer: string | null): void {
  const request = state.current
  state.current = null
  request?.resolve(answer)
}

/** The app's own confirm and prompt, themed like the rest of the UI. Rendered by DialogHost. */
export function useDialog() {
  return {
    state,
    settle,
    confirm: async (options: Options): Promise<boolean> => (await ask('confirm', options)) !== null,
    prompt: (options: Options): Promise<string | null> => ask('prompt', options),
  }
}
