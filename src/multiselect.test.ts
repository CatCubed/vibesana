import { describe, expect, it } from 'vitest'
import { inOptionOrder, sameMembers, toggled } from './multiselect'

const options = [{ gid: 'api' }, { gid: 'admin' }, { gid: 'tests' }, { gid: 'docs' }]

describe('toggled', () => {
  it('adds a missing id and removes a present one, without changing the original', () => {
    const start = new Set(['api'])
    expect([...toggled(start, 'tests')]).toEqual(['api', 'tests'])
    expect([...toggled(start, 'api')]).toEqual([])
    expect([...start]).toEqual(['api'])
  })
})

describe('sameMembers', () => {
  it('ignores order and spots any difference', () => {
    expect(sameMembers(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(sameMembers(new Set(['a']), new Set(['a', 'b']))).toBe(false)
    expect(sameMembers(new Set(['a', 'c']), new Set(['a', 'b']))).toBe(false)
    expect(sameMembers(new Set(), new Set())).toBe(true)
  })
})

describe('inOptionOrder', () => {
  it('saves the picks in the order the options are listed, whatever order they were clicked in', () => {
    expect(inOptionOrder(options, new Set(['tests', 'api', 'admin']), [])).toEqual(['api', 'admin', 'tests'])
  })
  it('keeps a value that is no longer offered as an option', () => {
    const current = [{ gid: 'legacy' }, { gid: 'api' }]
    expect(inOptionOrder(options, new Set(['legacy', 'api', 'docs']), current)).toEqual(['legacy', 'api', 'docs'])
  })
  it('drops a no-longer-offered value once it is unpicked', () => {
    expect(inOptionOrder(options, new Set(['api']), [{ gid: 'legacy' }, { gid: 'api' }])).toEqual(['api'])
  })
  it('gives an empty list when nothing is picked', () => {
    expect(inOptionOrder(options, new Set(), [{ gid: 'api' }])).toEqual([])
  })
})
