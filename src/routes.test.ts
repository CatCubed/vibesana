import { describe, expect, it } from 'vitest'
import { asanaTaskGid, buildHash, parseHash } from './routes'

describe('parseHash', () => {
  it('reads a project', () => {
    expect(parseHash('#/project/123')).toEqual({ view: 'board', project: '123', task: null })
  })
  it('reads a project with an open task', () => {
    expect(parseHash('#/project/123/task/456')).toEqual({ view: 'board', project: '123', task: '456' })
  })
  it('reads the My Tasks and Activity views', () => {
    expect(parseHash('#/my')).toEqual({ view: 'my', project: null, task: null })
    expect(parseHash('#/activity/task/9')).toEqual({ view: 'activity', project: null, task: '9' })
  })
  it('reads a bare task link', () => {
    expect(parseHash('#/task/456')).toEqual({ view: null, project: null, task: '456' })
  })
  it('rejects empty, unknown and malformed hashes', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#/')).toBeNull()
    expect(parseHash('#/nope')).toBeNull()
    expect(parseHash('#/project/abc')).toBeNull()
    expect(parseHash('#/project/123/extra')).toBeNull()
  })
})

describe('buildHash', () => {
  it('round-trips every route shape', () => {
    for (const hash of ['#/project/123', '#/project/123/task/456', '#/my', '#/activity', '#/my/task/7', '#/task/456']) {
      expect(buildHash(parseHash(hash)!)).toBe(hash)
    }
  })
  it('is empty when there is nothing to point at', () => {
    expect(buildHash({ view: 'board', project: null, task: null })).toBe('')
  })
})

describe('asanaTaskGid', () => {
  it('reads the classic /0/<project>/<task> form', () => {
    expect(asanaTaskGid('https://app.asana.com/0/1200000000000001/1200000000000002')).toBe('1200000000000002')
    expect(asanaTaskGid('https://app.asana.com/0/1200000000000001/1200000000000002/f')).toBe('1200000000000002')
  })
  it('reads the newer /task/<id> form', () => {
    expect(asanaTaskGid('https://app.asana.com/1/111/project/222/task/333?focus=true')).toBe('333')
  })
  it('ignores other Asana pages and other sites', () => {
    expect(asanaTaskGid('https://app.asana.com/0/1200000000000001/list')).toBeNull()
    expect(asanaTaskGid('https://gitlab.example.com/0/1/1200000000000002')).toBeNull()
    expect(asanaTaskGid('https://notasana.com/0/1200000000000001/1200000000000002')).toBeNull()
  })
})

describe('sameNavState', () => {
  const base = { view: 'board', project: { gid: '1' }, task: null, stack: [] as string[] }
  it('treats entries showing the same thing as equal', async () => {
    const { sameNavState } = await import('./routes')
    expect(sameNavState(base, { ...base, project: { gid: '1' } })).toBe(true)
    expect(sameNavState({ ...base, task: '7', stack: ['7'] }, { ...base, task: '7', stack: ['7'] })).toBe(true)
  })
  it('tells apart a different task, project, view or task stack', async () => {
    const { sameNavState } = await import('./routes')
    expect(sameNavState(base, { ...base, task: '7', stack: ['7'] })).toBe(false)
    expect(sameNavState(base, { ...base, project: { gid: '2' } })).toBe(false)
    expect(sameNavState(base, { ...base, view: 'my' })).toBe(false)
    expect(sameNavState({ ...base, task: '9', stack: ['7', '9'] }, { ...base, task: '9', stack: ['9'] })).toBe(false)
  })
  it('never matches a missing or foreign entry', async () => {
    const { sameNavState } = await import('./routes')
    expect(sameNavState(null, base)).toBe(false)
    expect(sameNavState(base, undefined)).toBe(false)
  })
})
