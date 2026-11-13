export type RouteView = 'board' | 'my' | 'activity'

export interface Route {
  view: RouteView | null
  project: string | null
  task: string | null
}

const GID = /^\d+$/

export function parseHash(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!parts.length) return null
  const route: Route = { view: null, project: null, task: null }
  let i = 0
  if (parts[i] === 'project' && GID.test(parts[i + 1] ?? '')) {
    route.view = 'board'
    route.project = parts[i + 1]
    i += 2
  } else if (parts[i] === 'my' || parts[i] === 'activity') {
    route.view = parts[i] as RouteView
    i += 1
  }
  if (parts[i] === 'task' && GID.test(parts[i + 1] ?? '')) {
    route.task = parts[i + 1]
    i += 2
  }
  return i === parts.length && (route.view || route.task) ? route : null
}

export function buildHash(route: Route): string {
  let hash = '#'
  if (route.view === 'board' && route.project) hash += `/project/${route.project}`
  else if (route.view === 'my' || route.view === 'activity') hash += `/${route.view}`
  if (route.task) hash += `/task/${route.task}`
  return hash === '#' ? '' : hash
}

export function asanaTaskGid(href: string, base = 'https://app.asana.com/'): string | null {
  try {
    const url = new URL(href, base)
    if (!/(^|\.)asana\.com$/.test(url.hostname)) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const taskIndex = parts.indexOf('task')
    if (taskIndex !== -1 && GID.test(parts[taskIndex + 1] ?? '')) return parts[taskIndex + 1]
    if (parts[0] === '0' && parts.length >= 3 && /^\d{6,}$/.test(parts[2])) return parts[2]
    return null
  } catch {
    return null
  }
}

export function taskLink(project: string | null, task: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return base + buildHash({ view: project ? 'board' : null, project, task })
}
