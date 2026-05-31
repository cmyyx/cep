import { HeadScript } from '@/components/shared/head-script'

interface StructuredDataProps {
  type: 'WebApplication' | 'WebPage'
  name: string
  description: string
  url: string
}

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

  const data = { ...baseData, ...applicationData }

  return (
    <HeadScript
      id={`json-ld-${type.toLowerCase()}`}
      code={JSON.stringify(data)}
    />
  )
}
