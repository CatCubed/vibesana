export interface Named {
  gid: string
  name: string
}

export interface Section extends Named {}

export interface Colored extends Named {
  color: string | null
}

export interface Project extends Colored {
  icon?: string | null
}

export interface EnumOption extends Colored {
  enabled: boolean
}

export interface CustomField extends Named {
  resource_subtype: string
  display_value: string | null
  enum_value: Colored | null
  multi_enum_values: Colored[] | null
  enum_options?: EnumOption[]
  text_value?: string | null
  number_value?: number | null
  date_value?: { date: string } | null
}

export interface FieldDef extends Named {
  resource_subtype: string
  enum_options: EnumOption[] | null
}

export interface Person extends Named {
  photo: { image_27x27?: string } | null
}

export type Assignee = Person

export interface Card extends Named {
  completed: boolean
  start_on: string | null
  due_on: string | null
  assignee: Person | null
  tags: Colored[]
  projects: Colored[]
  custom_fields: CustomField[]
  parent: Named | null
  dependencies: { gid: string; completed?: boolean }[]
  num_subtasks: number
  modified_at?: string
}

/** A card plus the projects and columns it sits in. */
export type BoardTask = Card & { memberships: { project: Colored; section: Named | null }[] }

export interface Dependency {
  gid: string
  name?: string
  completed?: boolean
}

export interface TaskDetail extends Card {
  notes: string
  html_notes: string
  permalink_url: string
  created_at: string
  completed_at: string | null
  liked: boolean
  num_likes: number
  followers: Person[]
  dependencies: Dependency[]
  memberships: { project: Colored; section: Named | null }[]
}

export interface Subtask extends Named {
  completed: boolean
  is_rendered_as_separator: boolean
  assignee: Person | null
  due_on: string | null
  num_subtasks?: number
}

export interface Story {
  gid: string
  type: string
  resource_subtype: string
  text: string
  html_text: string | null
  created_at: string
  created_by: Person | null
  liked: boolean
  num_likes: number
  is_edited?: boolean
  custom_field?: Named | null
  old_enum_value?: Named | null
  new_enum_value?: Named | null
  old_section?: Named | null
  new_section?: Named | null
  project?: Named | null
}

export interface ActivityTask extends Named {
  completed: boolean
  modified_at: string
  projects: Colored[]
}

export interface Attachment {
  gid: string
  name: string
  download_url: string | null
  view_url: string | null
  host: string
  created_at: string
}

export interface TypeaheadResult extends Person {
  completed?: boolean
  parent?: Named | null
  memberships?: { project: Colored; section: Named | null }[]
  color?: string | null
  icon?: string | null
}

export interface AsanaEvent {
  action: 'changed' | 'added' | 'removed' | 'deleted' | 'undeleted'
  resource: { gid: string; resource_type: string }
  parent: { gid: string; resource_type: string } | null
}

export interface Page<T> {
  data: T[]
  next_page: { offset: string } | null
}
