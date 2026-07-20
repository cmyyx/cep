import { describe, expect, it } from 'vitest'
import { parseWikiRichText } from './wiki-rich-text'

describe('Wiki rich text parser', () => {
  it('parses nested style and glossary tags', () => {
    expect(parseWikiRichText('Deals <@ba.fire>Fire <#ba.consume>damage</></> now')).toEqual([
      { type: 'text', text: 'Deals ' },
      {
        type: 'style',
        id: 'ba.fire',
        children: [
          { type: 'text', text: 'Fire ' },
          { type: 'term', id: 'ba.consume', children: [{ type: 'text', text: 'damage' }] },
        ],
      },
      { type: 'text', text: ' now' },
    ])
  })

  it('parses verified inline image syntax', () => {
    expect(parseWikiRichText('<image="TermIcon/icon_term_ba_fire" scale=1.25>')).toEqual([
      { type: 'image', path: 'TermIcon/icon_term_ba_fire', scale: 1.25 },
    ])
  })

  it('degrades malformed and unsupported tags to text', () => {
    expect(parseWikiRichText('<script>x</script> <@ba.fire>open')).toEqual([
      { type: 'text', text: '<script>x</script> <@ba.fire>open' },
    ])
  })
})
