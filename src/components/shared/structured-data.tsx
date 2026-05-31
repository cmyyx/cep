interface StructuredDataProps {
  type: 'WebApplication' | 'WebPage'
  name: string
  description: string
  url?: string
}

export function StructuredData({ type, name, description, url }: StructuredDataProps) {
  const siteUrl = 'https://end.canmoe.com'

  const data = {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url: url || siteUrl,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
