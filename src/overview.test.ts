import { describe, expect, it } from 'vitest'
import { toResourceLinks, type ProjectResource } from './overview'

const link = (over: Partial<ProjectResource>): ProjectResource => ({ gid: '1', name: 'Stage admin', resource_subtype: 'external', view_url: 'https://www.stage.example.com/admin', ...over })

describe('toResourceLinks', () => {
  it('opens a link where it points and names its site', () => {
    expect(toResourceLinks([link({})])).toEqual([
      { gid: '1', label: 'Stage admin', href: 'https://www.stage.example.com/admin', kind: 'link', source: 'stage.example.com' },
    ])
  })
  it('opens a file in its viewer and names the service it is stored in', () => {
    const file: ProjectResource = { gid: '2', name: 'spec.pdf', resource_subtype: 'asana', view_url: 'https://app.asana.com/app/asana/-/get_asset?x', download_url: 'https://s3.example.com/x' }
    expect(toResourceLinks([file])[0]).toMatchObject({ kind: 'file', href: 'https://app.asana.com/app/asana/-/get_asset?x', source: 'Asana file' })
  })
  it('falls back to the download address for a file without a viewer', () => {
    const file: ProjectResource = { gid: '2', name: 'dump.sql', host: 'asana', download_url: 'https://s3.example.com/x' }
    expect(toResourceLinks([file])[0]).toMatchObject({ kind: 'file', href: 'https://s3.example.com/x' })
  })
  it('puts links before files and keeps the given order within each', () => {
    const list = toResourceLinks([
      { gid: 'f1', name: 'a.png', resource_subtype: 'gdrive', view_url: 'https://drive.example.com/a' },
      link({ gid: 'l1' }),
      { gid: 'f2', name: 'b.png', resource_subtype: 'unknown', view_url: 'https://files.example.com/b' },
      link({ gid: 'l2', name: 'Docs' }),
    ])
    expect(list.map((l) => l.gid)).toEqual(['l1', 'l2', 'f1', 'f2'])
    expect(list.map((l) => l.source)).toEqual(['stage.example.com', 'stage.example.com', 'Google Drive', 'File'])
  })
  it('leaves out anything without a usable web address', () => {
    expect(toResourceLinks([link({ view_url: 'javascript:alert(1)' }), link({ view_url: null }), link({ view_url: 'ftp://x' })])).toEqual([])
  })
  it('labels an unnamed link with its site', () => {
    expect(toResourceLinks([link({ name: '  ' })])[0].label).toBe('stage.example.com')
  })
  it('treats host "external" as a link when the subtype is missing', () => {
    expect(toResourceLinks([{ gid: '9', name: 'Wiki', host: 'external', view_url: 'https://wiki.example.com' }])[0].kind).toBe('link')
  })
})
