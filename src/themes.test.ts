import { describe, expect, it } from 'vitest'
import { DARK_PALETTES, LIGHT_PALETTES, PALETTES, TOKENS, paletteFor } from './themes'

const HEX = /^#[0-9a-f]{6}$/

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('palettes', () => {
  it('have unique ids', () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length)
  })
  it('define every token as a hex colour', () => {
    for (const palette of PALETTES) {
      expect(palette.accent, palette.id).toMatch(HEX)
      for (const key of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
        expect(palette[key], `${palette.id}.${key}`).toMatch(HEX)
      }
    }
  })
  it('are dark or light as declared', () => {
    for (const palette of DARK_PALETTES) expect(luminance(palette.bg), palette.id).toBeLessThan(0.1)
    for (const palette of LIGHT_PALETTES) expect(luminance(palette.bg), palette.id).toBeGreaterThan(0.6)
  })
  it('keep body text readable on cards and panels', () => {
    for (const palette of PALETTES) {
      expect(contrast(palette.text, palette.card), `${palette.id} text/card`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.text, palette.surface), `${palette.id} text/surface`).toBeGreaterThanOrEqual(4.5)
      for (const ground of ['surface', 'surface2', 'card', 'sidebar'] as const) {
        expect(contrast(palette.muted, palette[ground]), `${palette.id} muted/${ground}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('paletteFor', () => {
  it('finds a palette by id within its mode', () => {
    expect(paletteFor('nord', 'dark').label).toBe('Nord')
    expect(paletteFor('catppuccin-latte', 'light').label).toBe('Catppuccin Latte')
  })
  it('falls back to the mode default for unknown or wrong-mode ids', () => {
    expect(paletteFor('nope', 'dark').id).toBe('tock')
    expect(paletteFor('navy', 'dark').id).toBe('tock')
    expect(paletteFor('nord', 'light').id).toBe('tock-light')
  })
})

describe('published themes use their official colours', () => {
  // Signature colours per theme, as published by its authors. Every one must appear in our mapping.
  // Muted text is not pinned: several themes publish a tone too faint for small labels, so ours is raised to 4.5:1.
  const OFFICIAL: Record<string, string[]> = {
    'catppuccin-mocha': ['#11111b', '#181825', '#1e1e2e', '#313244', '#45475a', '#cdd6f4', '#a6adc8', '#cba6f7', '#a6e3a1', '#f38ba8', '#f9e2af'],
    'catppuccin-macchiato': ['#181926', '#1e2030', '#24273a', '#363a4f', '#494d64', '#cad3f5', '#a5adcb', '#c6a0f6', '#a6da95', '#ed8796', '#eed49f'],
    'catppuccin-frappe': ['#232634', '#292c3c', '#303446', '#414559', '#51576d', '#c6d0f5', '#a5adce', '#ca9ee6', '#a6d189', '#e78284', '#e5c890'],
    'catppuccin-latte': ['#dce0e8', '#e6e9ef', '#eff1f5', '#ccd0da', '#bcc0cc', '#4c4f69', '#8839ef', '#40a02b', '#d20f39', '#df8e1d'],
    darcula: ['#2b2b2b', '#313335', '#3c3f41', '#bbbbbb', '#cc7832', '#ffc66d', '#555555'],
    dracula: ['#282a36', '#44475a', '#f8f8f2', '#bd93f9', '#50fa7b', '#ff5555', '#f1fa8c'],
    nord: ['#2e3440', '#3b4252', '#434c5e', '#4c566a', '#d8dee9', '#eceff4', '#88c0d0', '#a3be8c', '#bf616a', '#ebcb8b'],
    'nord-light': ['#d8dee9', '#e5e9f0', '#eceff4', '#2e3440', '#4c566a', '#5e81ac', '#bf616a'],
    'tokyo-night': ['#16161e', '#1a1b26', '#292e42', '#3b4261', '#414868', '#c0caf5', '#7aa2f7', '#9ece6a', '#f7768e', '#e0af68'],
    gruvbox: ['#1d2021', '#282828', '#3c3836', '#504945', '#665c54', '#ebdbb2', '#fbf1c7', '#fe8019', '#b8bb26', '#fb4934', '#fabd2f'],
    'gruvbox-light': ['#fbf1c7', '#f2e5bc', '#ebdbb2', '#d5c4a1', '#bdae93', '#3c3836', '#282828', '#af3a03', '#79740e', '#9d0006', '#b57614'],
    'one-dark': ['#282c34', '#21252b', '#2c313a', '#3e4451', '#4b5263', '#abb2bf', '#61afef', '#98c379', '#e06c75', '#e5c07b'],
    'one-light': ['#fafafa', '#eaeaeb', '#e5e5e6', '#dbdbdc', '#383a42', '#4078f2', '#50a14f', '#e45649', '#c18401'],
    'solarized-dark': ['#002b36', '#073642', '#586e75', '#93a1a1', '#eee8d5', '#268bd2', '#859900', '#dc322f', '#b58900'],
    'solarized-light': ['#eee8d5', '#fdf6e3', '#073642', '#002b36', '#93a1a1', '#268bd2', '#859900', '#dc322f', '#b58900'],
    'rose-pine': ['#191724', '#1f1d2e', '#26233a', '#403d52', '#524f67', '#e0def4', '#908caa', '#c4a7e7', '#9ccfd8', '#eb6f92', '#f6c177'],
    'rose-pine-dawn': ['#faf4ed', '#fffaf3', '#f2e9e1', '#dfdad9', '#cecacd', '#575279', '#907aa9', '#286983', '#b4637a', '#ea9d34'],
    'github-dark': ['#0d1117', '#010409', '#161b22', '#21262d', '#30363d', '#e6edf3', '#8b949e', '#2f81f7', '#3fb950', '#f85149', '#d29922'],
    'github-light': ['#f6f8fa', '#ffffff', '#d0d7de', '#1f2328', '#656d76', '#0969da', '#1a7f37', '#cf222e', '#9a6700'],
    'everforest-dark': ['#232a2e', '#2d353b', '#343f44', '#475258', '#4f585e', '#d3c6aa', '#a7c080', '#e67e80', '#dbbc7f'],
    'everforest-light': ['#fdf6e3', '#f4f0d9', '#efebd4', '#e6e2cc', '#e0dcc7', '#bdc3af', '#5c6a72', '#8da101', '#f85552', '#dfa000'],
    monokai: ['#272822', '#f8f8f2', '#3e3d32', '#75715e', '#a6e22e', '#f92672', '#e6db74'],
    'night-owl': ['#011627', '#d6deeb', '#82aaff'],
    'ayu-dark': ['#0a0e14', '#b3b1ad', '#e6b450'],
    'ayu-mirage': ['#1f2430', '#cbccc6', '#ffcc66'],
    'ayu-light': ['#fafafa', '#575f66', '#ff9940'],
    kanagawa: ['#16161d', '#1f1f28', '#dcd7ba'],
  }

  it.each(Object.entries(OFFICIAL))('%s', (id, colours) => {
    const palette = PALETTES.find((p) => p.id === id)
    expect(palette, id).toBeDefined()
    const used = new Set(Object.values(palette!).filter((v) => typeof v === 'string'))
    for (const colour of colours) expect(used.has(colour), `${id} should use ${colour}`).toBe(true)
  })
})
