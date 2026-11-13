import { afterEach, describe, expect, it } from 'vitest'
import { FONTS, fontUrl, loadFont, type FontDef } from './fonts'

describe('fontUrl', () => {
  it('builds a weight list for a font without italics', () => {
    expect(fontUrl(FONTS['fira-code'])).toBe('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap')
  })
  it('lists upright weights before italic ones, as Google Fonts requires', () => {
    expect(fontUrl(FONTS['jetbrains-mono'])).toBe(
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800&display=swap',
    )
  })
  it('needs no stylesheet for bundled or system fonts', () => {
    expect(fontUrl(FONTS.nunito)).toBeNull()
    expect(fontUrl(FONTS.system)).toBeNull()
  })
  it('gives every font a label and a stack that names it', () => {
    for (const font of Object.values(FONTS) as FontDef[]) {
      expect(font.label).toBeTruthy()
      if (font.kind !== 'system') expect(font.stack).toContain(font.label)
    }
  })
})

describe('loadFont', () => {
  afterEach(() => document.getElementById('vibesana-font')?.remove())

  it('adds one stylesheet link and swaps it when the font changes', () => {
    loadFont(FONTS.inter)
    loadFont(FONTS['jetbrains-mono'])
    const links = document.querySelectorAll('#vibesana-font')
    expect(links.length).toBe(1)
    expect((links[0] as HTMLLinkElement).href).toContain('JetBrains+Mono')
  })
  it('removes the link for a font that needs none', () => {
    loadFont(FONTS.inter)
    loadFont(FONTS.nunito)
    expect(document.getElementById('vibesana-font')).toBeNull()
  })
})
