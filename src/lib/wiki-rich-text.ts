export type WikiRichTextNode =
  | { type: 'text'; text: string }
  | { type: 'style'; id: string; children: WikiRichTextNode[] }
  | { type: 'term'; id: string; children: WikiRichTextNode[] }
  | { type: 'image'; path: string; scale: number }

interface ParseResult {
  nodes: WikiRichTextNode[]
  cursor: number
  closed: boolean
  valid: boolean
}

function appendText(nodes: WikiRichTextNode[], text: string) {
  if (!text) return
  const previous = nodes.at(-1)
  if (previous?.type === 'text') previous.text += text
  else nodes.push({ type: 'text', text })
}

function parseSequence(value: string, start: number, nested: boolean): ParseResult {
  const nodes: WikiRichTextNode[] = []
  let cursor = start

  while (cursor < value.length) {
    if (value.startsWith('</>', cursor)) {
      return nested
        ? { nodes, cursor: cursor + 3, closed: true, valid: true }
        : { nodes, cursor, closed: false, valid: false }
    }

    const image = value.slice(cursor).match(/^<image="([A-Za-z0-9_./-]+)"\s+scale=([0-9.]+)>/)
    if (image) {
      nodes.push({ type: 'image', path: image[1], scale: Number(image[2]) })
      cursor += image[0].length
      continue
    }

    const opening = value.slice(cursor).match(/^<([@#])([A-Za-z0-9._-]+)>/)
    if (opening) {
      const child = parseSequence(value, cursor + opening[0].length, true)
      if (!child.valid || !child.closed) return { nodes, cursor, closed: false, valid: false }
      nodes.push({
        type: opening[1] === '@' ? 'style' : 'term',
        id: opening[2],
        children: child.nodes,
      })
      cursor = child.cursor
      continue
    }

    const nextTag = value.indexOf('<', cursor + 1)
    appendText(nodes, value.slice(cursor, nextTag === -1 ? value.length : nextTag))
    cursor = nextTag === -1 ? value.length : nextTag
  }

  return { nodes, cursor, closed: false, valid: !nested }
}

export function parseWikiRichText(value: string): WikiRichTextNode[] {
  const result = parseSequence(value, 0, false)
  return result.valid && result.cursor === value.length
    ? result.nodes
    : [{ type: 'text', text: value }]
}
