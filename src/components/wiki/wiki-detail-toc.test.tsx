import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { WikiDetailToc } from './wiki-detail-toc'

const messages = { wiki: { tableOfContents: 'Table of contents', contentsRail: 'Contents' } }

it('renders the initial expanded edge directory without a modal overlay', () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <WikiDetailToc
        items={[{ id: 'skills', label: 'Skills' }]}
        activeId="skills"
        expanded
        onExpandedChange={() => undefined}
        onNavigate={() => undefined}
      />
    </NextIntlClientProvider>,
  )

  expect(html).toContain('data-wiki-toc-panel="true"')
  expect(html).toContain('data-expanded="true"')
  expect(html).toContain('href="#skills"')
  expect(html).toContain('aria-current="location"')
  expect(html).not.toContain('role="dialog"')
})

it('keeps tucked directory links out of keyboard navigation', () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <WikiDetailToc
        items={[{ id: 'skills', label: 'Skills' }]}
        activeId=""
        expanded={false}
        onExpandedChange={() => undefined}
        onNavigate={() => undefined}
      />
    </NextIntlClientProvider>,
  )

  expect(html).toContain('data-expanded="false"')
  expect(html).toContain('tabindex="-1"')
  expect(html).toContain('aria-hidden="true"')
})
