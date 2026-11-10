import { JsonLd } from '@/components/shared/json-ld'

interface StructuredDataProps {
  type: 'WebApplication' | 'WebPage'
  name: string
  description: string
  url: string
}

/**
 * Schema.org description of a tool page. Rendering (and `<` escaping) lives in
 * `<JsonLd>`; this keeps the WebApplication fields in one place.
 */
export function StructuredData({ type, name, description, url }: StructuredDataProps) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url,
  }

  const applicationData = type === 'WebApplication'
    ? {
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'CNY',
        },
      }
    : {}

  return <JsonLd id={type.toLowerCase()} data={{ ...baseData, ...applicationData }} />
}
