import type {
  ActivityTask,
  AsanaEvent,
  Attachment,
  BoardTask,
  Card,
  Dependency,
  FieldDef,
  Named,
  Page,
  Person,
  Project,
  Section,
  Story,
  Subtask,
  TaskDetail,
  TypeaheadResult,
} from '../types'

const TOKEN_KEY = 'asana-board:token'
const CARD_FIELDS = [
  'name',
  'completed',
  'start_on',
  'due_on',
  'assignee.name',
  'assignee.photo.image_27x27',
  'tags.name',
  'tags.color',
  'projects.name',
  'projects.color',
  'custom_fields.name',
  'custom_fields.resource_subtype',
  'custom_fields.display_value',
  'custom_fields.enum_value.name',
  'custom_fields.enum_value.color',
  'custom_fields.multi_enum_values.name',
  'custom_fields.multi_enum_values.color',
  'parent.name',
  'dependencies.completed',
  'num_subtasks',
  'modified_at',
].join(',')
const DETAIL_FIELDS = [
  CARD_FIELDS,
  'notes',
  'html_notes',
  'permalink_url',
  'created_at',
  'completed_at',
  'liked',
  'num_likes',
  'followers.name',
  'followers.photo.image_27x27',
  'memberships.project.name',
  'memberships.project.color',
  'memberships.section.name',
  'dependencies',
  'custom_fields.enum_options.name',
  'custom_fields.enum_options.color',
  'custom_fields.enum_options.enabled',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.date_value',
].join(',')
const SUBTASK_FIELDS = 'name,completed,is_rendered_as_separator,assignee.name,assignee.photo.image_27x27,due_on,num_subtasks'
const STORY_FIELDS =
  'type,resource_subtype,text,html_text,created_at,created_by.name,created_by.photo.image_27x27,liked,num_likes,is_edited,' +
  'custom_field.name,old_enum_value.name,new_enum_value.name,old_section.name,new_section.name,project.name'

export const PAGE_SIZE = 50

export class AsanaError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown = null,
  ) {
    super(message)
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

async function request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/asana${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${getToken() ?? ''}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify({ data: body }) : undefined,
    })
  } catch {
    // fetch only throws when nothing answered: no network, or the local proxy is not running.
    throw new AsanaError(0, "Can't reach Asana. Check your connection.", null)
  }

  if (response.status === 429 && attempt < 3) {
    const wait = Number(response.headers.get('Retry-After') ?? '5')
    await new Promise((resolve) => setTimeout(resolve, wait * 1000))
    return request(method, path, body, attempt + 1)
  }

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    const message = json?.errors?.[0]?.message ?? `${response.status} ${response.statusText}`
    throw new AsanaError(response.status, message, json)
  }
  return json as T
}

const get = <T>(path: string) => request<T>('GET', path)

export async function me(): Promise<Person & { workspaces: Named[] }> {
  return (
    await get<{ data: Person & { workspaces: Named[] } }>('/users/me?opt_fields=name,photo.image_27x27,workspaces.name')
  ).data
}

export async function project(gid: string): Promise<Project> {
  return (await get<{ data: Project }>(`/projects/${gid}?opt_fields=name,color,icon`)).data
}

export async function favoriteProjects(workspace: string): Promise<Project[]> {
  return (
    await get<{ data: Project[] }>(
      `/users/me/favorites?resource_type=project&workspace=${workspace}&opt_fields=name,color,icon`,
    )
  ).data
}

export async function searchProjects(workspace: string, query: string): Promise<Project[]> {
  const q = encodeURIComponent(query)
  return (
    await get<{ data: Project[] }>(
      `/workspaces/${workspace}/typeahead?resource_type=project&count=20&query=${q}&opt_fields=name,color,icon`,
    )
  ).data
}

async function getAll<T>(path: string): Promise<T[]> {
  const items: T[] = []
  let offset: string | null = null
  do {
    const separator = path.includes('?') ? '&' : '?'
    const page: Page<T> = await get<Page<T>>(`${path}${separator}limit=100${offset ? `&offset=${offset}` : ''}`)
    items.push(...page.data)
    offset = page.next_page?.offset ?? null
  } while (offset)
  return items
}

export async function myProjects(workspace: string, me: string): Promise<Project[]> {
  const projects = await getAll<Project & { members: { gid: string }[] }>(
    `/projects?workspace=${workspace}&archived=false&opt_fields=name,color,icon,members`,
  )
  return projects
    .filter((p) => p.members.some((m) => m.gid === me))
    .map(({ gid, name, color, icon }) => ({ gid, name, color, icon }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function sections(project: string): Promise<Section[]> {
  return (await get<{ data: Section[] }>(`/projects/${project}/sections?opt_fields=name`)).data
}

export async function createSection(
  project: string,
  name: string,
  position: { insert_after?: string; insert_before?: string } = {},
): Promise<Section> {
  return (
    await request<{ data: Section }>('POST', `/projects/${project}/sections?opt_fields=name`, { name, ...position })
  ).data
}

export async function renameSection(gid: string, name: string): Promise<void> {
  await request('PUT', `/sections/${gid}`, { name })
}

export async function deleteSection(gid: string): Promise<void> {
  await request('DELETE', `/sections/${gid}`)
}

export async function moveSection(
  project: string,
  section: string,
  position: { before_section?: string; after_section?: string },
): Promise<void> {
  await request('POST', `/projects/${project}/sections/insert`, { section, ...position })
}

export async function sectionTasks(section: string, includeCompleted: boolean, offset?: string): Promise<Page<Card>> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), opt_fields: CARD_FIELDS })
  if (!includeCompleted) params.set('completed_since', 'now')
  if (offset) params.set('offset', offset)
  return get<Page<Card>>(`/sections/${section}/tasks?${params}`)
}

export async function userTaskList(workspace: string): Promise<string> {
  return (await get<{ data: { gid: string } }>(`/users/me/user_task_list?workspace=${workspace}&opt_fields=gid`)).data.gid
}

export async function myTasks(listGid: string): Promise<Card[]> {
  const all: Card[] = []
  let offset: string | null = null
  do {
    const params = new URLSearchParams({ completed_since: 'now', limit: '100', opt_fields: CARD_FIELDS })
    if (offset) params.set('offset', offset)
    const page: Page<Card> = await get<Page<Card>>(`/user_task_lists/${listGid}/tasks?${params}`)
    all.push(...page.data)
    offset = page.next_page?.offset ?? null
  } while (offset && all.length < 1000)
  return all
}

export async function createMyTask(workspace: string, assignee: string, name: string, dueOn: string | null): Promise<Card> {
  return (
    await request<{ data: Card }>('POST', `/tasks?opt_fields=${CARD_FIELDS}`, {
      name,
      workspace,
      assignee,
      ...(dueOn ? { due_on: dueOn } : {}),
    })
  ).data
}

export async function task(gid: string): Promise<TaskDetail> {
  return (await get<{ data: TaskDetail }>(`/tasks/${gid}?opt_fields=${DETAIL_FIELDS}`)).data
}

const BOARD_TASK_FIELDS = [CARD_FIELDS, 'memberships.project.name', 'memberships.project.color', 'memberships.section.name'].join(',')

/** A task with just what a board card shows plus where it lives: the light version used when syncing. */
export async function boardTask(gid: string): Promise<BoardTask> {
  return (await get<{ data: BoardTask }>(`/tasks/${gid}?opt_fields=${BOARD_TASK_FIELDS}`)).data
}

export async function subtasks(gid: string): Promise<Subtask[]> {
  return (await get<{ data: Subtask[] }>(`/tasks/${gid}/subtasks?opt_fields=${SUBTASK_FIELDS}`)).data
}

export async function subtaskStates(gid: string): Promise<{ completed: boolean; is_rendered_as_separator: boolean }[]> {
  return (
    await get<{ data: { completed: boolean; is_rendered_as_separator: boolean }[] }>(
      `/tasks/${gid}/subtasks?opt_fields=completed,is_rendered_as_separator`,
    )
  ).data
}

export async function createSubtask(parent: string, name: string, separator = false): Promise<Subtask> {
  return (
    await request<{ data: Subtask }>('POST', `/tasks/${parent}/subtasks?opt_fields=${SUBTASK_FIELDS}`, {
      name,
      ...(separator ? { is_rendered_as_separator: true } : {}),
    })
  ).data
}

export async function createTaskFull(fields: Record<string, unknown>): Promise<TaskDetail> {
  return (await request<{ data: TaskDetail }>('POST', `/tasks?opt_fields=${DETAIL_FIELDS}`, fields)).data
}

export async function duplicateTask(gid: string, name: string): Promise<string> {
  const job = (
    await request<{ data: { new_task: { gid: string } } }>('POST', `/tasks/${gid}/duplicate?opt_fields=new_task.gid`, {
      name,
      include: ['notes', 'assignee', 'subtasks', 'attachments', 'tags', 'followers', 'projects', 'dates', 'dependencies', 'parent'],
    })
  ).data
  return job.new_task.gid
}

export async function setParent(
  task: string,
  parent: string | null,
  position: { insert_after?: string; insert_before?: string },
): Promise<void> {
  await request('POST', `/tasks/${task}/setParent`, { parent, ...position })
}

export async function deleteTask(gid: string): Promise<void> {
  await request('DELETE', `/tasks/${gid}`)
}

export async function activityTasks(workspace: string, me: string, since: string): Promise<ActivityTask[]> {
  const fields = 'name,completed,modified_at,projects.name,projects.color'
  const query = (filter: string) =>
    get<{ data: ActivityTask[] }>(
      `/workspaces/${workspace}/tasks/search?${filter}=${me}&modified_at.after=${encodeURIComponent(since)}&sort_by=modified_at&sort_ascending=false&limit=50&opt_fields=${fields}`,
    ).then((result) => result.data)
  const [following, assigned] = await Promise.all([query('followers.any'), query('assignee.any')])
  const byGid = new Map<string, ActivityTask>()
  for (const task of [...following, ...assigned]) byGid.set(task.gid, task)
  return [...byGid.values()].sort((a, b) => b.modified_at.localeCompare(a.modified_at))
}

export async function commentCount(gid: string): Promise<number> {
  const all = (await get<{ data: { type: string }[] }>(`/tasks/${gid}/stories?opt_fields=type`)).data
  return all.filter((story) => story.type === 'comment').length
}

export async function stories(gid: string): Promise<Story[]> {
  return (await get<{ data: Story[] }>(`/tasks/${gid}/stories?opt_fields=${STORY_FIELDS}`)).data
}

export async function addComment(gid: string, htmlText: string): Promise<Story> {
  return (
    await request<{ data: Story }>('POST', `/tasks/${gid}/stories?opt_fields=${STORY_FIELDS}`, {
      html_text: htmlText,
    })
  ).data
}

export async function updateComment(gid: string, htmlText: string): Promise<Story> {
  return (
    await request<{ data: Story }>('PUT', `/stories/${gid}?opt_fields=${STORY_FIELDS}`, { html_text: htmlText })
  ).data
}

export async function deleteComment(gid: string): Promise<void> {
  await request('DELETE', `/stories/${gid}`)
}

export async function likeStory(gid: string, liked: boolean): Promise<void> {
  await request('PUT', `/stories/${gid}`, { liked })
}

export async function attachments(gid: string): Promise<Attachment[]> {
  return (
    await get<{ data: Attachment[] }>(
      `/attachments?parent=${gid}&opt_fields=name,download_url,view_url,host,created_at`,
    )
  ).data
}

export async function uploadAttachment(gid: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('parent', gid)
  form.append('file', file, file.name)
  const response = await fetch('/asana/attachments?opt_fields=name,download_url,view_url,host,created_at', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken() ?? ''}`, Accept: 'application/json' },
    body: form,
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) throw new AsanaError(response.status, json?.errors?.[0]?.message ?? response.statusText, json)
  return json.data as Attachment
}

export async function deleteAttachment(gid: string): Promise<void> {
  await request('DELETE', `/attachments/${gid}`)
}

export async function typeahead(
  workspace: string,
  type: 'user' | 'task' | 'project',
  query: string,
): Promise<TypeaheadResult[]> {
  const fields = type === 'user' ? 'name,photo.image_27x27' : type === 'task'
        ? 'name,completed,parent.name,memberships.project.name,memberships.project.color,memberships.section.name'
        : 'name,color,icon'
  const q = encodeURIComponent(query)
  return (
    await get<{ data: TypeaheadResult[] }>(
      `/workspaces/${workspace}/typeahead?resource_type=${type}&count=10&query=${q}&opt_fields=${fields}`,
    )
  ).data
}

export async function addFollowers(gid: string, followers: string[]): Promise<void> {
  await request('POST', `/tasks/${gid}/addFollowers`, { followers })
}

export async function removeFollowers(gid: string, followers: string[]): Promise<void> {
  await request('POST', `/tasks/${gid}/removeFollowers`, { followers })
}

export async function dependencies(gid: string): Promise<Dependency[]> {
  return (await get<{ data: Dependency[] }>(`/tasks/${gid}/dependencies?opt_fields=name,completed`)).data
}

export async function dependents(gid: string): Promise<Dependency[]> {
  return (await get<{ data: Dependency[] }>(`/tasks/${gid}/dependents?opt_fields=name,completed`)).data
}

/** Adds a task to a project. Give at most one of: a section (task goes to its bottom) or a neighbouring task. */
export async function addProject(
  gid: string,
  project: string,
  position: { section?: string; insert_before?: string; insert_after?: string } = {},
): Promise<void> {
  await request('POST', `/tasks/${gid}/addProject`, { project, ...position })
}

export async function removeProject(gid: string, project: string): Promise<void> {
  await request('POST', `/tasks/${gid}/removeProject`, { project })
}

export async function addDependencies(gid: string, dependencies: string[]): Promise<void> {
  await request('POST', `/tasks/${gid}/addDependencies`, { dependencies })
}

export async function removeDependencies(gid: string, dependencies: string[]): Promise<void> {
  await request('POST', `/tasks/${gid}/removeDependencies`, { dependencies })
}

export async function addDependents(gid: string, dependents: string[]): Promise<void> {
  await request('POST', `/tasks/${gid}/addDependents`, { dependents })
}

export async function removeDependents(gid: string, dependents: string[]): Promise<void> {
  await request('POST', `/tasks/${gid}/removeDependents`, { dependents })
}

const fieldCache = new Map<string, Promise<FieldDef[]>>()

export function projectFields(project: string): Promise<FieldDef[]> {
  let cached = fieldCache.get(project)
  if (!cached) {
    cached = get<{ data: { custom_field: FieldDef }[] }>(
      `/projects/${project}/custom_field_settings?opt_fields=custom_field.gid,custom_field.name,custom_field.resource_subtype,custom_field.enum_options.name,custom_field.enum_options.color,custom_field.enum_options.enabled`,
    )
      .then((result) => result.data.map((setting) => setting.custom_field))
      .catch(() => [])
    fieldCache.set(project, cached)
  }
  return cached
}

export async function updateTask(gid: string, fields: Record<string, unknown>): Promise<TaskDetail> {
  return (await request<{ data: TaskDetail }>('PUT', `/tasks/${gid}?opt_fields=${DETAIL_FIELDS}`, fields)).data
}

export async function createTask(project: string, section: string, name: string): Promise<Card> {
  return (
    await request<{ data: Card }>('POST', `/tasks?opt_fields=${CARD_FIELDS}`, {
      name,
      projects: [project],
      memberships: [{ project, section }],
    })
  ).data
}

export async function moveTask(
  section: string,
  task: string,
  position: { insert_before?: string; insert_after?: string },
): Promise<void> {
  await request('POST', `/sections/${section}/addTask`, { task, ...position })
}

export async function events(
  project: string,
  sync: string | null,
): Promise<{ events: AsanaEvent[]; sync: string; reset: boolean }> {
  const path = `/events?resource=${project}${sync ? `&sync=${sync}` : ''}`
  try {
    const result = await get<{ data: AsanaEvent[]; sync: string }>(path)
    return { events: result.data, sync: result.sync, reset: false }
  } catch (error) {
    if (error instanceof AsanaError && error.status === 412) {
      const body = error.body as { sync: string }
      return { events: [], sync: body.sync, reset: sync !== null }
    }
    throw error
  }
}
