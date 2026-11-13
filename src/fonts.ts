export interface FontDef {
  label: string
  kind: 'sans' | 'mono' | 'system'
  /** CSS font-family stack. */
  stack: string
  /** Google Fonts family name, with the weights it offers and whether it has italics. Omitted for fonts already loaded by index.html or installed locally. */
  google?: { family: string; weights: number[]; italic: boolean }
}

const sans = (family: string) => `'${family}', system-ui, sans-serif`
const mono = (family: string) => `'${family}', ui-monospace, 'JetBrains Mono', Menlo, monospace`
const web = (family: string, weights: number[], italic: boolean) => ({ family, weights, italic })
const FULL = [400, 500, 600, 700, 800]
const TO_700 = [400, 500, 600, 700]

export const FONTS = {
  // Loaded by index.html
  nunito: { label: 'Nunito', kind: 'sans', stack: sans('Nunito') },
  'nunito-sans': { label: 'Nunito Sans', kind: 'sans', stack: sans('Nunito Sans') },
  manrope: { label: 'Manrope', kind: 'sans', stack: sans('Manrope') },
  jakarta: { label: 'Plus Jakarta Sans', kind: 'sans', stack: sans('Plus Jakarta Sans') },
  // Loaded on demand
  inter: { label: 'Inter', kind: 'sans', stack: sans('Inter'), google: web('Inter', FULL, true) },
  'dm-sans': { label: 'DM Sans', kind: 'sans', stack: sans('DM Sans'), google: web('DM Sans', FULL, true) },
  figtree: { label: 'Figtree', kind: 'sans', stack: sans('Figtree'), google: web('Figtree', FULL, true) },
  rubik: { label: 'Rubik', kind: 'sans', stack: sans('Rubik'), google: web('Rubik', FULL, true) },
  'ibm-plex-sans': { label: 'IBM Plex Sans', kind: 'sans', stack: sans('IBM Plex Sans'), google: web('IBM Plex Sans', TO_700, true) },
  'source-sans': { label: 'Source Sans 3', kind: 'sans', stack: sans('Source Sans 3'), google: web('Source Sans 3', FULL, true) },
  'work-sans': { label: 'Work Sans', kind: 'sans', stack: sans('Work Sans'), google: web('Work Sans', FULL, true) },
  lexend: { label: 'Lexend', kind: 'sans', stack: sans('Lexend'), google: web('Lexend', FULL, false) },
  outfit: { label: 'Outfit', kind: 'sans', stack: sans('Outfit'), google: web('Outfit', FULL, false) },
  'space-grotesk': { label: 'Space Grotesk', kind: 'sans', stack: sans('Space Grotesk'), google: web('Space Grotesk', TO_700, false) },
  roboto: { label: 'Roboto', kind: 'sans', stack: sans('Roboto'), google: web('Roboto', FULL, true) },
  'open-sans': { label: 'Open Sans', kind: 'sans', stack: sans('Open Sans'), google: web('Open Sans', FULL, true) },
  'jetbrains-mono': { label: 'JetBrains Mono', kind: 'mono', stack: mono('JetBrains Mono'), google: web('JetBrains Mono', FULL, true) },
  'fira-code': { label: 'Fira Code', kind: 'mono', stack: mono('Fira Code'), google: web('Fira Code', TO_700, false) },
  'ibm-plex-mono': { label: 'IBM Plex Mono', kind: 'mono', stack: mono('IBM Plex Mono'), google: web('IBM Plex Mono', TO_700, true) },
  'source-code-pro': { label: 'Source Code Pro', kind: 'mono', stack: mono('Source Code Pro'), google: web('Source Code Pro', FULL, true) },
  'roboto-mono': { label: 'Roboto Mono', kind: 'mono', stack: mono('Roboto Mono'), google: web('Roboto Mono', TO_700, true) },
  system: { label: 'System', kind: 'system', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
} as const satisfies Record<string, FontDef>

export type Font = keyof typeof FONTS

/** The Google Fonts stylesheet URL for a font that is loaded on demand, or null if it needs none. */
export function fontUrl(font: FontDef): string | null {
  if (!font.google) return null
  const { family, weights, italic } = font.google
  const name = family.trim().replace(/\s+/g, '+')
  const axis = italic
    ? `ital,wght@${weights.map((w) => `0,${w}`).join(';')};${weights.map((w) => `1,${w}`).join(';')}`
    : `wght@${weights.join(';')}`
  return `https://fonts.googleapis.com/css2?family=${name}:${axis}&display=swap`
}

/** Adds (or swaps) the stylesheet link for an on-demand font. */
export function loadFont(font: FontDef): void {
  const url = fontUrl(font)
  const existing = document.getElementById('vibesana-font') as HTMLLinkElement | null
  if (!url) {
    existing?.remove()
    return
  }
  if (existing) {
    if (existing.href !== url) existing.href = url
    return
  }
  const link = document.createElement('link')
  link.id = 'vibesana-font'
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}
