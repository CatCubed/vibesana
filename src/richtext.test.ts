import { describe, expect, it } from 'vitest'
import { renderRichText, serializeRichText } from './richtext'

function serialize(html: string): string {
  const root = document.createElement('div')
  root.innerHTML = html
  return serializeRichText(root)
}

describe('serializeRichText', () => {
  it('wraps plain text in a body', () => {
    expect(serialize('hello')).toBe('<body>hello</body>')
  })
  it('maps browser formatting tags to the ones Asana accepts', () => {
    expect(serialize('<b>a</b><i>b</i><strike>c</strike><u>d</u>')).toBe(
      '<body><strong>a</strong><em>b</em><s>c</s><u>d</u></body>',
    )
  })
  it('escapes text', () => {
    expect(serialize('a &lt; b &amp; c')).toBe('<body>a &lt; b &amp; c</body>')
  })
  it('turns line breaks and blocks into newlines without doubling them', () => {
    expect(serialize('a<br>b')).toBe('<body>a\nb</body>')
    expect(serialize('<div>a</div><div>b</div>')).toBe('<body>a\nb</body>')
    expect(serialize('<div>a<br></div><div>b</div>')).toBe('<body>a\nb</body>')
  })
  it('keeps one empty line and caps longer runs', () => {
    expect(serialize('<div>a</div><div><br></div><div>b</div>')).toBe('<body>a\n\nb</body>')
    expect(serialize('a<br><br><br><br>b')).toBe('<body>a\n\nb</body>')
  })
  it('trims leading and trailing blank lines', () => {
    expect(serialize('<br>a<br><br>')).toBe('<body>a</body>')
  })
  it('keeps lists', () => {
    expect(serialize('<ul><li>a</li><li>b</li></ul>')).toBe('<body><ul><li>a</li><li>b</li></ul></body>')
  })
  it('keeps titled links and links bare URLs', () => {
    expect(serialize('<a href="https://x.test/1">Title</a>')).toBe('<body><a href="https://x.test/1">Title</a></body>')
    expect(serialize('see https://x.test/a?b=1&amp;c=2.')).toBe(
      '<body>see <a href="https://x.test/a?b=1&amp;c=2">https://x.test/a?b=1&amp;c=2</a>.</body>',
    )
  })
  it('does not link URLs inside links or code', () => {
    expect(serialize('<a href="https://x.test">https://x.test</a>')).toBe(
      '<body><a href="https://x.test">https://x.test</a></body>',
    )
    expect(serialize('<code>https://x.test</code>')).toBe('<body><code>https://x.test</code></body>')
  })
  it('drops unsafe links but keeps their text', () => {
    expect(serialize('<a href="javascript:alert(1)">x</a>')).toBe('<body>x</body>')
  })
  it('writes mentions and inline images by id only', () => {
    expect(serialize('<a data-asana-gid="42" data-asana-type="user" href="https://app.asana.com/0/42">@Ann</a>')).toBe(
      '<body><a data-asana-gid="42"/></body>',
    )
    expect(serialize('<img data-asana-gid="7" src="https://files.test/a.png">')).toBe('<body><img data-asana-gid="7"/></body>')
    expect(serialize('<img src="https://files.test/a.png">')).toBe('<body></body>')
  })
})

describe('renderRichText', () => {
  it('returns an empty string for nothing', () => {
    expect(renderRichText(null)).toBe('')
  })
  it('keeps allowed formatting and removes scripts and handlers', () => {
    const html = renderRichText('<body><strong onclick="x()">a</strong><script>alert(1)</script><span>b</span></body>')
    expect(html).toBe('<strong>a</strong>b')
  })
  it('makes safe links open in a new tab and neutralises unsafe ones', () => {
    expect(renderRichText('<body><a href="https://x.test">x</a></body>')).toBe(
      '<a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a>',
    )
    expect(renderRichText('<body><a href="javascript:alert(1)">x</a></body>')).toBe('<a>x</a>')
  })
  it('swaps inline image sources for the attachment URLs', () => {
    const html = renderRichText(
      '<body><img data-asana-gid="7" src="https://app.asana.com/get_asset?asset_id=7"></body>',
      new Map([['7', 'https://files.test/7.png']]),
    )
    expect(html).toContain('src="https://files.test/7.png"')
    expect(html).toContain('data-asana-gid="7"')
  })
  it('drops images without a usable source', () => {
    expect(renderRichText('<body><img src="data:image/png;base64,AAAA"></body>')).toBe('')
  })
  it('round-trips what it renders', () => {
    const xml = '<body><strong>a</strong>\n<ul><li>b</li></ul><a href="https://x.test/1">t</a></body>'
    const root = document.createElement('div')
    root.innerHTML = renderRichText(xml)
    expect(serializeRichText(root)).toBe(xml)
  })
})

describe('serializeRichText cleanup', () => {
  it('drops zero-width spaces left by typing shortcuts', () => {
    expect(serialize('<code>x</code>​more')).toBe('<body><code>x</code>more</body>')
  })
  it('drops the placeholder line break browsers keep inside headings and list items', () => {
    expect(serialize('<h1>Title<br></h1>')).toBe('<body><h1>Title</h1></body>')
    expect(serialize('<ul><li>a<br></li></ul>')).toBe('<body><ul><li>a</li></ul></body>')
  })
})

describe('serializeRichText with styled spans', () => {
  it('keeps bold, italic, underline and strike expressed as inline styles', () => {
    expect(serialize('<span style="font-weight: bold">a</span>')).toBe('<body><strong>a</strong></body>')
    expect(serialize('<span style="font-weight: 700">a</span>')).toBe('<body><strong>a</strong></body>')
    expect(serialize('<span style="font-style: italic">a</span>')).toBe('<body><em>a</em></body>')
    expect(serialize('<span style="text-decoration: underline">a</span>')).toBe('<body><u>a</u></body>')
    expect(serialize('<span style="text-decoration: line-through">a</span>')).toBe('<body><s>a</s></body>')
  })
  it('leaves plain spans and normal weights alone', () => {
    expect(serialize('<span>a</span><span style="font-weight: 400">b</span>')).toBe('<body>ab</body>')
  })
})

describe('tables', () => {
  it('renders a table from Asana instead of running the cells together', () => {
    const html = renderRichText('<body><table><tr><td>a</td><td><strong>b</strong></td></tr></table></body>')
    expect(html).toContain('<td>a</td>')
    expect(html).toContain('<td><strong>b</strong></td>')
  })
  it('sends a table back as a table, without the whitespace between rows', () => {
    expect(serialize('<table>\n <tbody>\n  <tr><td>a</td><th>b</th></tr>\n  <tr><td>c<br></td><td></td></tr>\n </tbody>\n</table>')).toBe(
      '<body><table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td></td></tr></table></body>',
    )
  })
})
