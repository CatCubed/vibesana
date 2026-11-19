/** A project attachment as Asana returns it; a project's "key resources" are its attachments. */
export interface ProjectResource {
  gid: string
  name: string
  /** "external" for a link; "asana", "dropbox", "gdrive" … for a file. */
  resource_subtype?: string | null
  host?: string | null
  view_url?: string | null
  permanent_url?: string | null
  download_url?: string | null
}

export interface ResourceLink {
  gid: string
  label: string
  href: string
  kind: 'link' | 'file'
  /** Where it leads: the site of a link, or the service a file is stored in. */
  source: string
}

const SAFE = /^https?:\/\//i

function firstSafe(...urls: (string | null | undefined)[]): string | null {
  return urls.find((url): url is string => typeof url === 'string' && SAFE.test(url)) ?? null
}

function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const SERVICES: Record<string, string> = {
  asana: 'Asana file',
  dropbox: 'Dropbox',
  gdrive: 'Google Drive',
  onedrive: 'OneDrive',
  box: 'Box',
  vimeo: 'Vimeo',
}

/**
 * Turns a project's attachments into clickable resources: links first, then files, each in Asana's order.
 * Anything without a usable http(s) address is left out.
 */
export function toResourceLinks(resources: readonly ProjectResource[]): ResourceLink[] {
  const links: ResourceLink[] = []
  for (const resource of resources) {
    const external = (resource.resource_subtype ?? resource.host) === 'external'
    // A link opens where it points; a file opens in its viewer, falling back to the (short-lived) download address.
    const href = external
      ? firstSafe(resource.view_url, resource.permanent_url)
      : firstSafe(resource.view_url, resource.permanent_url, resource.download_url)
    if (!href) continue
    const service = resource.resource_subtype ?? resource.host ?? ''
    links.push({
      gid: resource.gid,
      label: resource.name?.trim() || siteOf(href) || href,
      href,
      kind: external ? 'link' : 'file',
      source: external ? siteOf(href) : (SERVICES[service] ?? 'File'),
    })
  }
  return [...links.filter((l) => l.kind === 'link'), ...links.filter((l) => l.kind === 'file')]
}
