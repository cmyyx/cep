// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StructuredData } from './structured-data'

const mockHeadScript = vi.fn()
vi.mock('@/components/shared/head-script', () => ({
  HeadScript: (props: { id: string; code: string }) => {
    mockHeadScript(props)
    return <script data-testid="head-script" />
  },
}))

describe('StructuredData', () => {
  const defaultProps = {
    name: 'Test App',
    description: 'Test description',
    url: 'https://example.com/test',
  }

  beforeEach(() => {
    mockHeadScript.mockClear()
  })

  describe('when type is WebApplication', () => {
    it('renders HeadScript with correct id', () => {
      render(<StructuredData type="WebApplication" {...defaultProps} />)
      expect(mockHeadScript).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'json-ld-webapplication' }),
      )
    })

    it('includes applicationCategory, operatingSystem and offers in JSON-LD', () => {
      render(<StructuredData type="WebApplication" {...defaultProps} />)
      const call = mockHeadScript.mock.calls[0][0]
      const data = JSON.parse(call.code)

      expect(data).toEqual({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: defaultProps.name,
        description: defaultProps.description,
        url: defaultProps.url,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'CNY',
        },
      })
    })
  })

  describe('when type is WebPage', () => {
    it('renders HeadScript with correct id', () => {
      render(<StructuredData type="WebPage" {...defaultProps} />)
      expect(mockHeadScript).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'json-ld-webpage' }),
      )
    })

    it('does not include application-specific fields in JSON-LD', () => {
      render(<StructuredData type="WebPage" {...defaultProps} />)
      const call = mockHeadScript.mock.calls[0][0]
      const data = JSON.parse(call.code)

      expect(data).toEqual({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: defaultProps.name,
        description: defaultProps.description,
        url: defaultProps.url,
      })
      expect(data).not.toHaveProperty('applicationCategory')
      expect(data).not.toHaveProperty('operatingSystem')
      expect(data).not.toHaveProperty('offers')
    })
  })
})
