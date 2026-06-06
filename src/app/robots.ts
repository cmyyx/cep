import type { MetadataRoute } from 'next'
import { DEFAULT_SITE_URL } from '@/lib/constants'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = DEFAULT_SITE_URL
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
