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
    title: t('settings.title'),
    description: t('meta.settingsDescription'),
    keywords: t('meta.settingsKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'settings'),
    openGraph: {
      title: `${t('settings.title')} - ${t('app.name')}`,
      description: t('meta.settingsDescription'),
      images: [`/og/settings/${locale}.png`],
    },
  }
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
