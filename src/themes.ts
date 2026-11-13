export interface Palette {
  id: string
  label: string
  mode: 'dark' | 'light'
  /** The theme's own signature colour, offered as the "Theme" accent. */
  accent: string
  bg: string
  sidebar: string
  surface: string
  surface2: string
  card: string
  chip: string
  text: string
  textStrong: string
  muted: string
  border: string
  borderStrong: string
  ok: string
  danger: string
  warn: string
}

export const TOKENS: Record<Exclude<keyof Palette, 'id' | 'label' | 'mode' | 'accent'>, string> = {
  bg: '--bg',
  sidebar: '--sidebar',
  surface: '--surface',
  surface2: '--surface-2',
  card: '--card',
  chip: '--chip',
  text: '--text',
  textStrong: '--text-strong',
  muted: '--muted',
  border: '--border',
  borderStrong: '--border-strong',
  ok: '--ok',
  danger: '--danger',
  warn: '--warn',
}

const dark = (p: Omit<Palette, 'mode'>): Palette => ({ ...p, mode: 'dark' })
const light = (p: Omit<Palette, 'mode'>): Palette => ({ ...p, mode: 'light' })


/**
 * Named themes use the colours their authors publish. Where a palette has no tone for one of our
 * surfaces (a third background step, a readable secondary text), the value is derived and marked.
 */
export const PALETTES: Palette[] = [
  // ---- Vibesana's own dark themes
  // Tock: the default dark theme, a neutral blue-gray with a green accent.
  dark({
    id: 'tock', label: 'Tock', accent: '#2ddb84',
    bg: '#141821', sidebar: '#10141b', surface: '#1d2330', surface2: '#232a38', card: '#272e3d', chip: '#323a4c',
    text: '#dde2ea', textStrong: '#ffffff', muted: /* derived */ '#8d96a6', border: '#2b3342', borderStrong: '#434d61',
    ok: '#2ddb84', danger: '#ff6b6b', warn: '#f5b942',
  }),
  dark({
    id: 'graphite', label: 'Graphite', accent: '#4f8cff',
    bg: '#161616', sidebar: '#1b1b1b', surface: '#1f1f1f', surface2: '#262626', card: '#2a2a2a', chip: '#363636',
    text: '#e3e3e3', textStrong: '#ffffff', muted: '#9a9a9a', border: '#303030', borderStrong: '#4a4a4a',
    ok: '#3ecf8e', danger: '#ff6b6b', warn: '#f5b942',
  }),
  dark({
    id: 'black', label: 'Black', accent: '#1fc877',
    bg: '#000000', sidebar: '#070707', surface: '#0e0e0e', surface2: '#161616', card: '#181818', chip: '#262626',
    text: '#e6e6e6', textStrong: '#ffffff', muted: '#8f8f8f', border: '#222222', borderStrong: '#3a3a3a',
    ok: '#3ecf8e', danger: '#ff6b6b', warn: '#f5b942',
  }),

  // ---- Published dark themes
  // Catppuccin Mocha: crust / mantle / base / surface0 / surface1, text, subtext0, mauve.
  dark({
    id: 'catppuccin-mocha', label: 'Catppuccin Mocha', accent: '#cba6f7',
    bg: '#11111b', sidebar: '#181825', surface: '#181825', surface2: '#11111b', card: '#1e1e2e', chip: '#313244',
    text: '#cdd6f4', textStrong: '#cdd6f4', muted: '#a6adc8', border: '#313244', borderStrong: '#45475a',
    ok: '#a6e3a1', danger: '#f38ba8', warn: '#f9e2af',
  }),
  // Catppuccin Macchiato: same roles as Mocha.
  dark({
    id: 'catppuccin-macchiato', label: 'Catppuccin Macchiato', accent: '#c6a0f6',
    bg: '#181926', sidebar: '#1e2030', surface: '#1e2030', surface2: '#181926', card: '#24273a', chip: '#363a4f',
    text: '#cad3f5', textStrong: '#cad3f5', muted: '#a5adcb', border: '#363a4f', borderStrong: '#494d64',
    ok: '#a6da95', danger: '#ed8796', warn: '#eed49f',
  }),
  // Catppuccin Frappé: same roles as Mocha.
  dark({
    id: 'catppuccin-frappe', label: 'Catppuccin Frappé', accent: '#ca9ee6',
    bg: '#232634', sidebar: '#292c3c', surface: '#292c3c', surface2: '#232634', card: '#303446', chip: '#414559',
    text: '#c6d0f5', textStrong: '#c6d0f5', muted: '#a5adce', border: '#414559', borderStrong: '#51576d',
    ok: '#a6d189', danger: '#e78284', warn: '#e5c890',
  }),
  // JetBrains Darcula: editor #2b2b2b, gutter #313335, tool windows #3c3f41, UI text #bbbbbb, keyword orange.
  dark({
    id: 'darcula', label: 'Darcula', accent: '#cc7832',
    bg: '#2b2b2b', sidebar: '#313335', surface: '#313335', surface2: '#2b2b2b', card: '#3c3f41', chip: '#4c5052',
    text: '#bbbbbb', textStrong: '#e8e8e8' /* derived */, muted: /* derived */ '#aaaaaa', border: '#45494a', borderStrong: '#555555',
    ok: '#499c54', danger: '#ff6b68', warn: '#ffc66d',
  }),
  // Dracula: background, current line, foreground, comment, purple; #21222c and #191a21 are its darker UI tones.
  dark({
    id: 'dracula', label: 'Dracula', accent: '#bd93f9',
    bg: '#191a21', sidebar: '#21222c', surface: '#282a36', surface2: '#21222c', card: '#343746', chip: '#44475a',
    text: '#f8f8f2', textStrong: '#ffffff', muted: /* derived */ '#98a2c0', border: '#343746', borderStrong: '#44475a',
    ok: '#50fa7b', danger: '#ff5555', warn: '#f1fa8c',
  }),
  // Nord: Polar Night nord0-3, Snow Storm nord4/6, Frost nord8. Nord has no readable mid-gray, so muted is derived.
  dark({
    id: 'nord', label: 'Nord', accent: '#88c0d0',
    bg: '#2e3440', sidebar: '#2e3440', surface: '#3b4252', surface2: '#2e3440', card: '#434c5e', chip: '#4c566a',
    text: '#d8dee9', textStrong: '#eceff4', muted: /* derived */ '#b4bdce' /* derived */, border: '#434c5e', borderStrong: '#4c566a',
    ok: '#a3be8c', danger: '#bf616a', warn: '#ebcb8b',
  }),
  // Tokyo Night: bg_dark, bg, bg_highlight, fg_gutter, terminal_black, fg, dark5, blue.
  dark({
    id: 'tokyo-night', label: 'Tokyo Night', accent: '#7aa2f7',
    bg: '#16161e', sidebar: '#16161e', surface: '#1a1b26', surface2: '#16161e', card: '#292e42', chip: '#3b4261',
    text: '#c0caf5', textStrong: '#c0caf5', muted: /* derived */ '#8c94bd', border: '#292e42', borderStrong: '#414868',
    ok: '#9ece6a', danger: '#f7768e', warn: '#e0af68',
  }),
  // Gruvbox dark: bg0_h, bg0, bg1, bg2, bg3, fg1, fg0, fg4, bright orange.
  dark({
    id: 'gruvbox', label: 'Gruvbox Dark', accent: '#fe8019',
    bg: '#1d2021', sidebar: '#282828', surface: '#282828', surface2: '#1d2021', card: '#3c3836', chip: '#504945',
    text: '#ebdbb2', textStrong: '#fbf1c7', muted: /* derived */ '#b0a18a', border: '#3c3836', borderStrong: '#665c54',
    ok: '#b8bb26', danger: '#fb4934', warn: '#fabd2f',
  }),
  // One Dark: #282c34 editor, #21252b panels, #2c313a line highlight, #3e4451 selection, #181a1f borders.
  dark({
    id: 'one-dark', label: 'One Dark', accent: '#61afef',
    bg: '#21252b', sidebar: '#21252b', surface: '#282c34', surface2: '#21252b', card: '#2c313a', chip: '#3e4451',
    text: '#abb2bf', textStrong: '#d7dae0', muted: /* derived */ '#9298a4', border: '#181a1f', borderStrong: '#4b5263',
    ok: '#98c379', danger: '#e06c75', warn: '#e5c07b',
  }),
  // Solarized dark only has two background tones (base03, base02); the page and chip tones are derived.
  dark({
    id: 'solarized-dark', label: 'Solarized Dark', accent: '#268bd2',
    bg: '#00212b' /* derived */, sidebar: '#002b36', surface: '#002b36', surface2: '#00212b' /* derived */,
    card: '#073642', chip: '#0f4a5a' /* derived */,
    text: '#93a1a1', textStrong: '#eee8d5', muted: /* derived */ '#8c9b9c', border: '#073642', borderStrong: '#586e75',
    ok: '#859900', danger: '#dc322f', warn: '#b58900',
  }),
  // Rosé Pine: base, surface, overlay, highlight med/high, text, subtle, iris, foam, love, gold.
  dark({
    id: 'rose-pine', label: 'Rosé Pine', accent: '#c4a7e7',
    bg: '#191724', sidebar: '#191724', surface: '#1f1d2e', surface2: '#191724', card: '#26233a', chip: '#403d52',
    text: '#e0def4', textStrong: '#e0def4', muted: '#908caa', border: '#26233a', borderStrong: '#524f67',
    ok: '#9ccfd8', danger: '#eb6f92', warn: '#f6c177',
  }),
  // GitHub Dark: canvas default/subtle/inset, border default, fg default/muted, accent, success, danger, attention.
  dark({
    id: 'github-dark', label: 'GitHub Dark', accent: '#2f81f7',
    bg: '#0d1117', sidebar: '#010409', surface: '#161b22', surface2: '#0d1117', card: '#21262d', chip: '#30363d',
    text: '#e6edf3', textStrong: '#ffffff', muted: '#8b949e', border: '#30363d', borderStrong: '#484f58',
    ok: '#3fb950', danger: '#f85149', warn: '#d29922',
  }),
  // Everforest dark (medium): bg_dim, bg0, bg1, bg3, bg4, fg, grey2, green.
  dark({
    id: 'everforest-dark', label: 'Everforest Dark', accent: '#a7c080',
    bg: '#232a2e', sidebar: '#2d353b', surface: '#2d353b', surface2: '#232a2e', card: '#343f44', chip: '#475258',
    text: '#d3c6aa', textStrong: '#d3c6aa', muted: /* derived */ '#a1aba1', border: '#3d484d', borderStrong: '#4f585e',
    ok: '#a7c080', danger: '#e67e80', warn: '#dbbc7f',
  }),
  // Monokai: #272822 background, #f8f8f2 text, #75715e comments, #3e3d32 line highlight, pink / green / yellow.
  dark({
    id: 'monokai', label: 'Monokai', accent: '#a6e22e',
    bg: '#1e1f1c', sidebar: '#1e1f1c', surface: '#272822', surface2: '#1e1f1c', card: '#34352f' /* derived */, chip: '#3e3d32',
    text: '#f8f8f2', textStrong: '#ffffff', muted: '#a59f85' /* derived: #75715e is too dark for text */,
    border: '#3e3d32', borderStrong: '#75715e',
    ok: '#a6e22e', danger: '#f92672', warn: '#e6db74',
  }),
  // Night Owl: #011627 background, #d6deeb text, #0b2942 / #1d3b53 highlights, #5f7e97 secondary, blue accent.
  dark({
    id: 'night-owl', label: 'Night Owl', accent: '#82aaff',
    bg: '#010e1a', sidebar: '#011627', surface: '#011627', surface2: '#010e1a', card: '#0b2942', chip: '#1d3b53',
    text: '#d6deeb', textStrong: '#ffffff', muted: '#7f96ad' /* derived from #5f7e97 */, border: '#122d42', borderStrong: '#1d3b53',
    ok: '#addb67', danger: '#ef5350', warn: '#ecc48d',
  }),
  // Ayu Dark: #0a0e14 background, #b3b1ad text, #e6b450 accent. The panel and card steps are derived.
  dark({
    id: 'ayu-dark', label: 'Ayu Dark', accent: '#e6b450',
    bg: '#0a0e14', sidebar: '#0a0e14', surface: '#0d1017', surface2: '#0a0e14', card: '#131721', chip: '#1f2430' /* derived */,
    text: '#b3b1ad', textStrong: '#e6e1cf', muted: '#7a828e' /* derived */, border: '#1a1f29' /* derived */, borderStrong: '#2d3640' /* derived */,
    ok: '#aad94c', danger: '#f07178', warn: '#e6b450',
  }),
  // Ayu Mirage: #1f2430 background, #cbccc6 text, #ffcc66 accent. The panel and card steps are derived.
  dark({
    id: 'ayu-mirage', label: 'Ayu Mirage', accent: '#ffcc66',
    bg: '#171b24', sidebar: '#1a1f29', surface: '#1f2430', surface2: '#171b24', card: '#272d3b' /* derived */, chip: '#343b4c' /* derived */,
    text: '#cbccc6', textStrong: '#ffffff', muted: /* derived */ '#8d94a4' /* derived */, border: '#2a3040' /* derived */, borderStrong: '#3d4558' /* derived */,
    ok: '#d5ff80', danger: '#f28779', warn: '#ffcc66',
  }),
  // Kanagawa (wave): sumiInk0-4, fujiWhite, oldWhite, fujiGray, crystalBlue, springGreen, peachRed, carpYellow.
  dark({
    id: 'kanagawa', label: 'Kanagawa', accent: '#7e9cd8',
    bg: '#16161d', sidebar: '#16161d', surface: '#1f1f28', surface2: '#16161d', card: '#2a2a37', chip: '#363646',
    text: '#dcd7ba', textStrong: '#dcd7ba', muted: '#9a9889' /* derived: fujiGray #727169 is too dark for text */,
    border: '#2a2a37', borderStrong: '#54546d',
    ok: '#98bb6c', danger: '#ff5d62', warn: '#e6c384',
  }),

  // ---- Light themes
  // Tock Light: warm off-white page, sage sidebar, white cards, plum-gray text.
  light({
    id: 'tock-light', label: 'Tock Light', accent: '#2cdd89',
    bg: '#f6f7f4', sidebar: '#edefe9', surface: '#ffffff', surface2: '#f6f7f4', card: '#ffffff', chip: '#e8eae4',
    text: '#655d76', textStrong: '#33294a', muted: /* derived */ '#706980', border: '#e8eae4', borderStrong: /* derived */ '#d3d7cb',
    ok: '#22b573', danger: '#ff5f8f', warn: '#e0a400',
  }),
  light({
    id: 'light', label: 'Light', accent: '#1fc877',
    bg: '#eef1f5', sidebar: '#ffffff', surface: '#ffffff', surface2: '#f5f7fa', card: '#ffffff', chip: '#e9edf2',
    text: '#1c2333', textStrong: '#0f1420', muted: /* derived */ '#656f7f', border: '#e1e6ec', borderStrong: '#c3cbd6',
    ok: '#17b36a', danger: '#e5484d', warn: '#e0a400',
  }),
  light({
    id: 'paper', label: 'Paper', accent: '#d9774a',
    bg: '#efe9df', sidebar: '#f7f3ec', surface: '#f7f3ec', surface2: '#efe9df', card: '#fffdf8', chip: '#e6dfd2',
    text: '#3a342c', textStrong: '#1f1b16', muted: /* derived */ '#70675d', border: '#e2dacb', borderStrong: '#c9bfae',
    ok: '#3f8f5a', danger: '#c8453b', warn: '#b7791f',
  }),
  // Catppuccin Latte: crust / mantle / base / surface0 / surface1, text, subtext0, mauve.
  light({
    id: 'catppuccin-latte', label: 'Catppuccin Latte', accent: '#8839ef',
    bg: '#dce0e8', sidebar: '#e6e9ef', surface: '#e6e9ef', surface2: '#dce0e8', card: '#eff1f5', chip: '#ccd0da',
    text: '#4c4f69', textStrong: '#4c4f69', muted: /* derived */ '#5f627a', border: '#ccd0da', borderStrong: '#bcc0cc',
    ok: '#40a02b', danger: '#d20f39', warn: '#df8e1d',
  }),
  // GitHub Light: canvas default/subtle, border default, fg default/muted, accent, success, danger, attention.
  light({
    id: 'github-light', label: 'GitHub Light', accent: '#0969da',
    bg: '#f6f8fa', sidebar: '#ffffff', surface: '#ffffff', surface2: '#f6f8fa', card: '#ffffff', chip: '#eaeef2',
    text: '#1f2328', textStrong: '#1f2328', muted: '#656d76', border: '#d0d7de', borderStrong: '#afb8c1',
    ok: '#1a7f37', danger: '#cf222e', warn: '#9a6700',
  }),
  // One Light: #fafafa editor, #eaeaeb panels, #e5e5e6 highlight, #dbdbdc borders, #383a42 text, #696c77 secondary.
  light({
    id: 'one-light', label: 'One Light', accent: '#4078f2',
    bg: '#eaeaeb', sidebar: '#fafafa', surface: '#fafafa', surface2: '#eaeaeb', card: '#ffffff', chip: '#e5e5e6',
    text: '#383a42', textStrong: '#383a42', muted: /* derived */ '#656873', border: '#dbdbdc', borderStrong: '#c2c2c3' /* derived */,
    ok: '#50a14f', danger: '#e45649', warn: '#c18401',
  }),
  // Solarized light: base2 / base3 backgrounds; body uses the darker base tones so text stays readable.
  light({
    id: 'solarized-light', label: 'Solarized Light', accent: '#268bd2',
    bg: '#e4ddc8' /* derived */, sidebar: '#eee8d5', surface: '#eee8d5', surface2: '#e4ddc8' /* derived */,
    card: '#fdf6e3', chip: '#ddd6c1' /* derived */,
    text: '#073642', textStrong: '#002b36', muted: /* derived */ '#4b656d', border: '#dcd5bf' /* derived */, borderStrong: '#93a1a1',
    ok: '#859900', danger: '#dc322f', warn: '#b58900',
  }),
  // Gruvbox light: bg1, bg0_s, bg0, bg2, bg3, fg1, fg0, fg4, faded orange / green / red / yellow.
  light({
    id: 'gruvbox-light', label: 'Gruvbox Light', accent: '#af3a03',
    bg: '#ebdbb2', sidebar: '#f2e5bc', surface: '#f2e5bc', surface2: '#ebdbb2', card: '#fbf1c7', chip: '#d5c4a1',
    text: '#3c3836', textStrong: '#282828', muted: /* derived */ '#685d55', border: '#d5c4a1', borderStrong: '#bdae93',
    ok: '#79740e', danger: '#9d0006', warn: '#b57614',
  }),
  // Nord light: Snow Storm nord4-6 backgrounds, Polar Night text, Frost nord10. Status colours are darkened for light.
  light({
    id: 'nord-light', label: 'Nord Light', accent: '#5e81ac',
    bg: '#d8dee9', sidebar: '#e5e9f0', surface: '#e5e9f0', surface2: '#d8dee9', card: '#eceff4', chip: '#d8dee9',
    text: '#2e3440', textStrong: '#2e3440', muted: '#4c566a', border: '#d8dee9', borderStrong: '#c2cad6' /* derived */,
    ok: '#5f8a52' /* derived */, danger: '#bf616a', warn: '#b58a2e' /* derived */,
  }),
  // Rosé Pine Dawn: overlay, base, surface, highlight med/high, text, subtle, iris, pine, love, gold.
  light({
    id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', accent: '#907aa9',
    bg: '#f2e9e1', sidebar: '#faf4ed', surface: '#faf4ed', surface2: '#f2e9e1', card: '#fffaf3', chip: '#dfdad9',
    text: '#575279', textStrong: '#575279', muted: /* derived */ '#6a6688', border: '#dfdad9', borderStrong: '#cecacd',
    ok: '#286983', danger: '#b4637a', warn: '#ea9d34',
  }),
  // Everforest light (medium): bg2, bg1, bg0, bg3, bg4, bg5, fg, green. Its grays are too pale for text, so muted is derived.
  light({
    id: 'everforest-light', label: 'Everforest Light', accent: '#8da101',
    bg: '#efebd4', sidebar: '#f4f0d9', surface: '#f4f0d9', surface2: '#efebd4', card: '#fdf6e3', chip: '#e6e2cc',
    text: '#5c6a72', textStrong: '#5c6a72', muted: /* derived */ '#5e6c72' /* derived */, border: '#e0dcc7', borderStrong: '#bdc3af',
    ok: '#8da101', danger: '#f85552', warn: '#dfa000',
  }),
  // Ayu Light: #fafafa background, #575f66 text, #ff9940 accent. The panel steps are derived.
  light({
    id: 'ayu-light', label: 'Ayu Light', accent: '#ff9940',
    bg: '#f0f1f2' /* derived */, sidebar: '#fafafa', surface: '#fafafa', surface2: '#f0f1f2' /* derived */, card: '#ffffff', chip: '#e8e9eb' /* derived */,
    text: '#575f66', textStrong: '#3a4046' /* derived */, muted: /* derived */ '#676e76' /* derived */, border: '#e4e5e7' /* derived */, borderStrong: '#c9ccd0' /* derived */,
    ok: '#86b300', danger: '#f07171', warn: '#f2ae49',
  }),
]

export const DARK_PALETTES = PALETTES.filter((p) => p.mode === 'dark')
export const LIGHT_PALETTES = PALETTES.filter((p) => p.mode === 'light')

/** The palette with this id for the given mode, or that mode's default (Tock / Tock Light). */
export function paletteFor(id: string, mode: 'dark' | 'light'): Palette {
  const list = mode === 'dark' ? DARK_PALETTES : LIGHT_PALETTES
  return list.find((p) => p.id === id) ?? list[0]
}
