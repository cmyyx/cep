import { wikiCharacters } from '@/generated/data/wiki/characters'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import { wikiEquipment } from '@/generated/data/wiki/equipment'

import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { getAlternates } from '@/lib/metadata'

export const dynamic = 'force-static'

/**
 * Route definitions.
 *
 * Each entry maps a URL path segment to its priority and change frequency.
 * The sitemap generator iterates over these, creating one <url> per route
 * with <xhtml:link rel="alternate" hreflang="..."> for every locale.
 *
 * To add a new page to the sitemap, add an entry here.
 * To remove a page, delete its entry. No XML editing needed.
 */
export const ROUTES: {
  path: string
  priority: number
  changefreq: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
}[] = [
  { path: '',                 priority: 0.7, changefreq: 'weekly'  }, // home
  { path: 'essence-planner',  priority: 1,   changefreq: 'weekly'  },
  { path: 'refinement-planner', priority: 1, changefreq: 'weekly'  },
  { path: 'growth-planner',   priority: 0.9, changefreq: 'weekly'  },
  { path: 'panel-preview',    priority: 0.9, changefreq: 'weekly'  },
  { path: 'banner-calendar',  priority: 0.9, changefreq: 'daily'   },
  { path: 'background-preview', priority: 0.6, changefreq: 'monthly' },
  { path: 'forum',            priority: 0.7, changefreq: 'weekly'  },
  { path: 'about',            priority: 0.5, changefreq: 'monthly' },
  { path: 'account',          priority: 0.3, changefreq: 'monthly' },
  { path: 'login',            priority: 0.3, changefreq: 'monthly' },
  { path: 'settings',         priority: 0.3, changefreq: 'monthly' },
  { path: 'update',           priority: 0.5, changefreq: 'weekly'  },
  { path: 'privacy',          priority: 0.2, changefreq: 'yearly'  },
  { path: 'wiki/characters',  priority: 0.7, changefreq: 'weekly'  },
  { path: 'wiki/weapons',     priority: 0.7, changefreq: 'weekly'  },
  { path: 'wiki/equipment',   priority: 0.7, changefreq: 'weekly'  },
  { path: 'terms',            priority: 0.2, changefreq: 'yearly'  },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const listUrls = ROUTES.map(({ path, priority, changefreq }) => {
    const { canonical, languages } = getAlternates(routing.defaultLocale, path)
    return {
      url: canonical,
      lastModified: new Date(),
      changeFrequency: changefreq,
      priority,
      alternates: { languages },
    }
  })

  const detailUrls: MetadataRoute.Sitemap = [
    ...wikiCharacters.map((c) => {
      const { canonical, languages } = getAlternates(routing.defaultLocale, `wiki/characters/${c.id}`)
      return {
        url: canonical,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
        alternates: { languages },
      }
    }),
    ...wikiWeapons.map((w) => {
      const { canonical, languages } = getAlternates(routing.defaultLocale, `wiki/weapons/${w.id}`)
      return {
        url: canonical,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
        alternates: { languages },
      }
    }),
    ...wikiEquipment.map((e) => {
      const { canonical, languages } = getAlternates(routing.defaultLocale, `wiki/equipment/${e.id}`)
      return {
        url: canonical,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
        alternates: { languages },
      }
    }),
  ]

  return [...listUrls, ...detailUrls]
}
