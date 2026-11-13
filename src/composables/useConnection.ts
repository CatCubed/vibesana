import { reactive } from 'vue'
import { AsanaError } from '../api/asana'
import { useToasts } from './useToasts'

const state = reactive({ offline: false, unauthorized: false })

/** Asana could not be reached at all (no network, proxy down), as opposed to Asana answering with an error. */
export function isUnreachable(error: unknown): boolean {
  return error instanceof AsanaError && error.status === 0
}

/**
 * One shared view of "can we talk to Asana?". Background polling reports here instead of raising a toast
 * every time it fails: the user hears once that the connection is gone and once that it is back.
 */
export function useConnection() {
  return {
    state,
    /** A background request worked. */
    succeeded(): void {
      if (!state.offline) return
      state.offline = false
      useToasts().success('Connected to Asana again')
    },
    /** A background request failed. Returns true when the failure is handled here and needs no message of its own. */
    failed(error: unknown): boolean {
      if (error instanceof AsanaError && error.status === 401) {
        state.unauthorized = true
        return true
      }
      if (!isUnreachable(error)) return false
      if (!state.offline) {
        state.offline = true
        useToasts().error("Can't reach Asana. Retrying in the background.")
      }
      return true
    },
    reset(): void {
      state.offline = false
      state.unauthorized = false
    },
  }
}
