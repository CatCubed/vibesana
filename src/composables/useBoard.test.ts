import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Card, TaskDetail } from '../types'

vi.mock('../api/asana', () => ({
  AsanaError: class AsanaError extends Error {
    status = 0
  },
  moveTask: vi.fn(async () => undefined),
  createTask: vi.fn(),
  updateTask: vi.fn(async () => ({})),
  sections: vi.fn(async () => []),
  sectionTasks: vi.fn(async () => ({ data: [], next_page: null })),
  events: vi.fn(async () => ({ events: [], sync: 's', reset: false })),
  task: vi.fn(),
}))
vi.mock('../cache', () => ({
  readCache: vi.fn(async () => undefined),
  writeCache: vi.fn(async () => undefined),
  pruneBoardCache: vi.fn(async () => undefined),
}))

import * as api from '../api/asana'
import { useBoard, type Board } from './useBoard'

const PROJECT = 'p1'

function card(gid: string, completed = false): Card {
  return {
    gid,
    name: `Task ${gid}`,
    completed,
    start_on: null,
    due_on: null,
    assignee: null,
    tags: [],
    projects: [],
    custom_fields: [],
    parent: null,
    dependencies: [],
    num_subtasks: 0,
  }
}

function detail(gid: string, section: string | null, completed = false): TaskDetail {
  return {
    ...card(gid, completed),
    notes: '',
    html_notes: '',
    permalink_url: '',
    created_at: '',
    completed_at: null,
    liked: false,
    num_likes: 0,
    followers: [],
    memberships: section ? [{ project: { gid: PROJECT, name: 'P', color: null }, section: { gid: section, name: section } }] : [],
  }
}

let board: Board

function seed(showCompleted = true): void {
  board = useBoard(PROJECT, showCompleted)
  board.column('todo').cards.push(card('a'), card('b'), card('c'))
  board.column('doing').cards.push(card('x'), card('y'))
  board.column('done')
  for (const section of ['todo', 'doing', 'done']) board.column(section).fresh = true
}

const order = (section: string) => board.column(section).cards.map((c) => c.gid)

beforeEach(() => {
  vi.clearAllMocks()
  seed()
})
afterEach(() => board.dispose())

describe('move', () => {
  it('moves a card down within its column and anchors it after the card above', async () => {
    await board.move('a', 'todo', 3)
    expect(order('todo')).toEqual(['b', 'c', 'a'])
    expect(api.moveTask).toHaveBeenCalledWith('todo', 'a', { insert_after: 'c' })
  })
  it('moves a card up within its column and anchors it before the card below', async () => {
    await board.move('c', 'todo', 0)
    expect(order('todo')).toEqual(['c', 'a', 'b'])
    expect(api.moveTask).toHaveBeenCalledWith('todo', 'c', { insert_before: 'a' })
  })
  it('moves a card into the middle of another column', async () => {
    await board.move('a', 'doing', 1)
    expect(order('todo')).toEqual(['b', 'c'])
    expect(order('doing')).toEqual(['x', 'a', 'y'])
    expect(api.moveTask).toHaveBeenCalledWith('doing', 'a', { insert_before: 'y' })
  })
  it('moves a card into an empty column without an anchor', async () => {
    await board.move('a', 'done', 0)
    expect(order('done')).toEqual(['a'])
    expect(api.moveTask).toHaveBeenCalledWith('done', 'a', {})
  })
  it('puts the card back and reports an error when Asana refuses', async () => {
    vi.mocked(api.moveTask).mockRejectedValueOnce(new Error('nope'))
    await board.move('a', 'doing', 2)
    expect(order('todo')).toEqual(['a', 'b', 'c'])
    expect(order('doing')).toEqual(['x', 'y'])
    expect(board.error.value).toContain('nope')
  })
  it('ignores a card that is not on the board', async () => {
    await board.move('zzz', 'doing', 0)
    expect(api.moveTask).not.toHaveBeenCalled()
  })
})

describe('relocate', () => {
  it('repositions a card locally without calling Asana', () => {
    board.relocate('a', 'doing', 2)
    expect(order('doing')).toEqual(['x', 'y', 'a'])
    expect(api.moveTask).not.toHaveBeenCalled()
  })
  it('clamps the position to the column', () => {
    board.relocate('a', 'done', 99)
    expect(order('done')).toEqual(['a'])
  })
})

describe('addCard', () => {
  it('adds at the top by default', async () => {
    vi.mocked(api.createTask).mockResolvedValueOnce(card('new'))
    await board.addCard('todo', 'New')
    expect(order('todo')).toEqual(['new', 'a', 'b', 'c'])
    expect(api.moveTask).toHaveBeenCalledWith('todo', 'new', {})
  })
  it('adds at the bottom after the last card', async () => {
    vi.mocked(api.createTask).mockResolvedValueOnce(card('new'))
    await board.addCard('todo', 'New', true)
    expect(order('todo')).toEqual(['a', 'b', 'c', 'new'])
    expect(api.moveTask).toHaveBeenCalledWith('todo', 'new', { insert_after: 'c' })
  })
  it('adds to an empty column at the bottom without an anchor', async () => {
    vi.mocked(api.createTask).mockResolvedValueOnce(card('new'))
    await board.addCard('done', 'New', true)
    expect(order('done')).toEqual(['new'])
    expect(api.moveTask).not.toHaveBeenCalled()
  })
})

describe('setCompleted', () => {
  it('keeps a completed card when completed tasks are shown', async () => {
    await board.setCompleted('b', true)
    expect(order('todo')).toEqual(['a', 'b', 'c'])
    expect(board.column('todo').cards[1].completed).toBe(true)
    expect(api.updateTask).toHaveBeenCalledWith('b', { completed: true })
  })
  it('removes a completed card when completed tasks are hidden', async () => {
    board.dispose()
    seed(false)
    await board.setCompleted('b', true)
    expect(order('todo')).toEqual(['a', 'c'])
  })
  it('restores the card when Asana refuses', async () => {
    board.dispose()
    seed(false)
    vi.mocked(api.updateTask).mockRejectedValueOnce(new Error('nope'))
    await board.setCompleted('b', true)
    expect(order('todo')).toEqual(['a', 'b', 'c'])
    expect(board.column('todo').cards[1].completed).toBe(false)
  })
})

describe('applyTask', () => {
  it('updates a card in place', () => {
    board.applyTask({ ...detail('b', 'todo'), name: 'Renamed' })
    expect(order('todo')).toEqual(['a', 'b', 'c'])
    expect(board.column('todo').cards[1].name).toBe('Renamed')
  })
  it('moves a card whose section changed to the top of the new column', () => {
    board.applyTask(detail('b', 'doing'))
    expect(order('todo')).toEqual(['a', 'c'])
    expect(order('doing')).toEqual(['b', 'x', 'y'])
  })
  it('adds a task that newly joined the project', () => {
    board.applyTask(detail('new', 'done'))
    expect(order('done')).toEqual(['new'])
  })
  it('removes a task that left the project', () => {
    board.applyTask(detail('b', null))
    expect(order('todo')).toEqual(['a', 'c'])
  })
  it('removes a completed task only when completed tasks are hidden', () => {
    board.applyTask(detail('b', 'todo', true))
    expect(order('todo')).toEqual(['a', 'b', 'c'])
    board.dispose()
    seed(false)
    board.applyTask(detail('b', 'todo', true))
    expect(order('todo')).toEqual(['a', 'c'])
  })
  it('does not add to a column that has not been loaded yet', () => {
    board.column('done').fresh = false
    board.applyTask(detail('new', 'done'))
    expect(order('done')).toEqual([])
  })
})

describe('mergeFirstPage', () => {
  it('takes the order of the fresh first page and keeps cards loaded beyond it after it', async () => {
    const { mergeFirstPage } = await import('./useBoard')
    const existing = [card('a'), card('b'), card('c'), card('d')]
    const page = [card('b'), card('new'), card('a')]
    expect(mergeFirstPage(existing, page).map((c) => c.gid)).toEqual(['b', 'new', 'a', 'c', 'd'])
  })
})

describe('failed writes', () => {
  it('reports a refused move and puts the card back where it was', async () => {
    vi.mocked(api.moveTask).mockRejectedValueOnce(new Error('nope'))
    const before = order('todo')
    expect(await board.move('a', 'doing', 0)).toBe(false)
    expect(order('todo')).toEqual(before)
    expect(order('doing')).not.toContain('a')
    expect(board.error.value).toContain('nope')
  })
  it('reports success for a move Asana accepted', async () => {
    expect(await board.move('a', 'doing', 0)).toBe(true)
  })
  it('reports a refused completion and reopens the card', async () => {
    vi.mocked(api.updateTask).mockRejectedValueOnce(new Error('nope'))
    expect(await board.setCompleted('b', true)).toBe(false)
    expect(board.column('todo').cards.find((c) => c.gid === 'b')?.completed).toBe(false)
  })
})

describe('applyTask', () => {
  it('keeps only what a card shows and says which column the task is in', () => {
    const fresh = { ...detail('a', 'doing'), html_notes: '<body>long</body>', notes: 'long' }
    expect(board.applyTask(fresh)).toBe('doing')
    const stored = board.column('doing').cards.find((c) => c.gid === 'a') as unknown as Record<string, unknown>
    expect(stored).toBeDefined()
    expect('html_notes' in stored).toBe(false)
    expect('followers' in stored).toBe(false)
    expect('memberships' in stored).toBe(false)
  })
  it('returns null for a task that left the project', () => {
    expect(board.applyTask(detail('a', null))).toBeNull()
  })
})
