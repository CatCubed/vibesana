import { describe, expect, it } from 'vitest'
import { useDialog } from './useDialog'

describe('useDialog', () => {
  const dialog = useDialog()

  it('resolves a confirm to true when confirmed and false when cancelled', async () => {
    const yes = dialog.confirm({ title: 'Delete?' })
    expect(dialog.state.current?.kind).toBe('confirm')
    dialog.settle('')
    expect(await yes).toBe(true)
    const no = dialog.confirm({ title: 'Delete?' })
    dialog.settle(null)
    expect(await no).toBe(false)
    expect(dialog.state.current).toBeNull()
  })
  it('resolves a prompt to the typed text, or null when cancelled', async () => {
    const answer = dialog.prompt({ title: 'Name', value: 'old' })
    expect(dialog.state.current?.value).toBe('old')
    dialog.settle('new')
    expect(await answer).toBe('new')
    const cancelled = dialog.prompt({ title: 'Name' })
    dialog.settle(null)
    expect(await cancelled).toBeNull()
  })
  it('cancels a dialog that is replaced by a newer one', async () => {
    const first = dialog.confirm({ title: 'First' })
    const second = dialog.confirm({ title: 'Second' })
    expect(await first).toBe(false)
    dialog.settle('')
    expect(await second).toBe(true)
  })
})
