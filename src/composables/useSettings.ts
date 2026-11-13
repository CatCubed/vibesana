import { reactive, watch } from 'vue'
import { asanaColor, readableOn, textOn } from '../colors'
import { DARK_PALETTES, LIGHT_PALETTES, TOKENS, paletteFor, type Palette } from '../themes'
import { FONTS, loadFont, type Font, type FontDef } from '../fonts'
import { readSetting, writeSetting } from '../settings'

export type Theme = 'system' | 'light' | 'dark'
export type Density = 'comfortable' | 'compact'
export type Indicator = 'chip' | 'stripe' | 'both' | 'none'

export { FONTS, type Font } from '../fonts'

export const COLUMN_WIDTHS = { narrow: 260, normal: 304, wide: 370, xwide: 440 } as const
export type ColumnWidth = keyof typeof COLUMN_WIDTHS

/** Text scale per font size option. */
export const FONT_SIZES = { small: 0.92, normal: 1, large: 1.1, xlarge: 1.2 } as const
export type FontSize = keyof typeof FONT_SIZES
/** Nunito's lowercase height as a share of the font size; every font is scaled to match it. */
const BASE_X_HEIGHT = 0.484

/** The font-size-adjust value for a font size option: it scales the text of every font without touching the layout. */
export function fontAdjust(size: string): string {
  const scale = (FONT_SIZES as Record<string, number>)[size] ?? FONT_SIZES.normal
  return (BASE_X_HEIGHT * scale).toFixed(3)
}

export interface CardPrefs {
  hidden: string[]
  tags: boolean
  assignee: boolean
  due: boolean
  subtasks: boolean
  comments?: boolean
  parent: boolean
}

export const DEFAULT_CARD_PREFS: CardPrefs = { hidden: [], tags: true, assignee: true, due: true, subtasks: true, parent: true }

export const ACCENTS = {
  green: '#1fc877',
  lime: '#a3d94a',
  teal: '#2bd4c4',
  cyan: '#38c6f4',
  blue: '#4f8cff',
  indigo: '#6d7cff',
  purple: '#9b7bff',
  magenta: '#d46bf0',
  pink: '#f26fb2',
  rose: '#ff6b81',
  red: '#f25555',
  orange: '#ff9f43',
  amber: '#f5c542',
  slate: '#8fa3bf',
} as const

export type Accent = keyof typeof ACCENTS | 'custom' | 'theme'

/** The colour to use for an accent choice; falls back to green for anything unknown or malformed. */
export function accentHex(accent: string, custom: string, themeAccent: string = ACCENTS.green): string {
  if (accent === 'theme') return themeAccent
  if (accent === 'custom') return /^#[0-9a-f]{6}$/i.test(custom) ? custom : ACCENTS.green
  return (ACCENTS as Record<string, string>)[accent] ?? ACCENTS.green
}

interface Settings {
  theme: Theme
  darkPalette: string
  lightPalette: string
  accent: Accent
  accentCustom: string
  density: Density
  indicator: Indicator
  font: Font
  fontSize: FontSize
  columnWidth: ColumnWidth
  glow: boolean
  dockedPanel: boolean
  animations: boolean
  showCompleted: boolean
  notifications: boolean
  sidebarOpen: boolean
  projectColors: Record<string, string>
  cardFields: Record<string, CardPrefs>
}

const settings = reactive<Settings>({
  theme: readSetting<Theme>('theme', 'system'),
  // Unknown or retired ids (for example the old "navy" and "slate") fall back to the first theme of the mode.
  darkPalette: paletteFor(readSetting('dark-palette', DARK_PALETTES[0].id), 'dark').id,
  lightPalette: paletteFor(readSetting('light-palette', LIGHT_PALETTES[0].id), 'light').id,
  accent: readSetting<Accent>('accent', 'green'),
  accentCustom: readSetting('accent-custom', '#1fc877'),
  density: readSetting<Density>('density', 'comfortable'),
  indicator: readSetting<Indicator>('indicator', 'chip'),
  font: readSetting<Font>('font', 'nunito'),
  fontSize: readSetting<FontSize>('font-size', 'normal'),
  columnWidth: readSetting<ColumnWidth>('column-width', 'normal'),
  glow: readSetting('glow', true),
  showCompleted: readSetting('show-completed', true),
  notifications: readSetting('notifications', false),
  dockedPanel: readSetting('docked-panel', true),
  animations: readSetting('animations', true),
  sidebarOpen: readSetting('sidebar-open', true),
  projectColors: readSetting<Record<string, string>>('project-colors', {}),
  cardFields: readSetting<Record<string, CardPrefs>>('card-fields', {}),
})

const systemDark = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

/** The palette in use right now, given the theme mode and the system preference. */
export function activePalette(): Palette {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && Boolean(systemDark?.matches))
  return paletteFor(dark ? settings.darkPalette : settings.lightPalette, dark ? 'dark' : 'light')
}

function apply(): void {
  const root = document.documentElement
  const palette = activePalette()
  for (const key of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) root.style.setProperty(TOKENS[key], palette[key])
  root.dataset.palette = palette.id
  if (settings.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = settings.theme
  root.dataset.density = settings.density
  root.dataset.glow = settings.glow ? 'on' : 'off'
  root.dataset.motion = settings.animations ? 'on' : 'off'
  const accent = accentHex(settings.accent, settings.accentCustom, palette.accent)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-contrast', textOn(accent))
  root.style.setProperty('--ok-contrast', readableOn(palette.ok))
  root.style.setProperty('--danger-contrast', readableOn(palette.danger))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.sidebar)
  const font: FontDef = FONTS[settings.font] ?? FONTS.nunito
  loadFont(font)
  root.style.setProperty('--font', font.stack)
  root.style.setProperty('--font-adjust', fontAdjust(settings.fontSize))
  root.style.setProperty('--text-scale', String(FONT_SIZES[settings.fontSize] ?? 1))
  root.style.setProperty('--column-width', `${COLUMN_WIDTHS[settings.columnWidth] ?? COLUMN_WIDTHS.normal}px`)
}

watch(
  settings,
  (value) => {
    apply()
    writeSetting('theme', value.theme)
    writeSetting('dark-palette', value.darkPalette)
    writeSetting('light-palette', value.lightPalette)
    writeSetting('accent', value.accent)
    writeSetting('accent-custom', value.accentCustom)
    writeSetting('density', value.density)
    writeSetting('indicator', value.indicator)
    writeSetting('font', value.font)
    writeSetting('font-size', value.fontSize)
    writeSetting('column-width', value.columnWidth)
    writeSetting('glow', value.glow)
    writeSetting('show-completed', value.showCompleted)
    writeSetting('notifications', value.notifications)
    writeSetting('docked-panel', value.dockedPanel)
    writeSetting('animations', value.animations)
    writeSetting('sidebar-open', value.sidebarOpen)
    writeSetting('project-colors', value.projectColors)
    writeSetting('card-fields', value.cardFields)
  },
  { deep: true },
)
apply()
systemDark?.addEventListener?.('change', apply)

export function useSettings(): Settings {
  return settings
}

export function projectColor(project: { gid: string; color: string | null }): string | null {
  return settings.projectColors[project.gid] ?? asanaColor(project.color)
}

export function cardPrefs(project: string): CardPrefs {
  return settings.cardFields[project] ?? DEFAULT_CARD_PREFS
}

export function setCardPrefs(project: string, prefs: CardPrefs): void {
  settings.cardFields = { ...settings.cardFields, [project]: prefs }
}

export function setProjectColor(gid: string, hex: string | null): void {
  const next = { ...settings.projectColors }
  if (hex) next[gid] = hex
  else delete next[gid]
  settings.projectColors = next
}
