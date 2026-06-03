import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('nav.characterGuide'),
    description: t('meta.characterGuideDescription'),
    keywords: t('meta.characterGuideKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'character-guide'),
    openGraph: {
      title: `${t('nav.characterGuide')} - ${t('app.name')}`,
      description: t('meta.characterGuideDescription'),
      images: [`/og/character-guide/${locale}.png`],
    },
  }
}

export default function CharacterGuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
