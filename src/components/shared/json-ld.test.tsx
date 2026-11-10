// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { JsonLd } from './json-ld'

function readLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]')
  expect(script).not.toBeNull()
  return { script: script as HTMLScriptElement, data: JSON.parse(script?.innerHTML ?? '{}') }
}

it('renders a JSON-LD script tag with the prefixed id', () => {
  const { container } = render(<JsonLd id="wiki-characters" data={{ '@type': 'Thing' }} />)
  const { script, data } = readLd(container)
  expect(script.id).toBe('json-ld-wiki-characters')
  expect(data).toEqual({ '@type': 'Thing' })
})

it('escapes < so entity names cannot close the script tag early', () => {
  const { container } = render(<JsonLd id="escape" data={{ name: 'a</script><b>' }} />)
  const { script } = readLd(container)
  expect(script.innerHTML).not.toContain('</script>')
  expect(script.innerHTML).toContain('\\u003c')
})
