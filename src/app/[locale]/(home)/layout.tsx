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
    title: { absolute: t('app.name') },
    description: t('meta.homeDescription'),
    keywords: t('meta.homeKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale),
    openGraph: {
      title: t('app.name'),
      description: t('meta.homeDescription'),
      images: [`/og/home/${locale}.png`],
    },
  }
}

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
