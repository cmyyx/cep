import type { MetadataRoute } from 'next'
import { DEFAULT_SITE_URL } from '@/lib/constants'

export const dynamic = 'force-static'

const SITE_URL = process.env.SITE_URL || DEFAULT_SITE_URL

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
