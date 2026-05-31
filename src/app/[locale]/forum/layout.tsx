import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('nav.forum'),
    description: t('meta.forumDescription'),
    keywords: t('meta.forumKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    openGraph: {
      title: `${t('nav.forum')} - ${t('app.name')}`,
      description: t('meta.forumDescription'),
      images: [`/og/forum/${locale}.png`],
    },
  }
}

export default function ForumLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
