export const PALETTE: Record<string, string> = {
  red: '#f06a6a',
  orange: '#ec8d71',
  'yellow-orange': '#f1bd6c',
  yellow: '#f8df72',
  'yellow-green': '#aecf55',
  green: '#5da283',
  'blue-green': '#4ecbc4',
  aqua: '#9ee7e3',
  blue: '#4573d2',
  indigo: '#8d84e8',
  purple: '#b36bd4',
  magenta: '#f9aaef',
  'hot-pink': '#f26fb2',
  pink: '#fc979a',
  'cool-gray': '#6d6e6f',
  'dark-pink': '#ea4e9d',
  'dark-green': '#62d26f',
  'dark-blue': '#4186e0',
  'dark-red': '#e8384f',
  'dark-teal': '#37c5ab',
  'dark-brown': '#a2734c',
  'dark-orange': '#fd612c',
  'dark-purple': '#7a6ff0',
  'dark-warm-gray': '#8da3a6',
  'light-pink': '#e362e3',
  'light-green': '#a4cf30',
  'light-blue': '#5a7896',
  'light-red': '#ff9ba0',
  'light-teal': '#20aaea',
  'light-brown': '#eec300',
  'light-orange': '#fd9a00',
  'light-purple': '#aa62e3',
  'light-warm-gray': '#b6aeae',
}

export function asanaColor(name: string | null | undefined): string | null {
  if (!name || name === 'none') return null
  return PALETTE[name] ?? null
}

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16)
  const channel = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255)
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Dark or white text, whichever reads better on this fill. */
export function readableOn(hex: string): string {
  return contrast(hex, '#0f1420') >= contrast(hex, '#ffffff') ? '#0f1420' : '#ffffff'
}

export function textOn(hex: string): string {
  const value = parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#0f1420' : '#ffffff'
}
