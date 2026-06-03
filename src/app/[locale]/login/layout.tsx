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
    title: t('nav.login'),
    description: t('meta.loginDescription'),
    keywords: t('meta.loginKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'login'),
    openGraph: {
      title: `${t('nav.login')} - ${t('app.name')}`,
      description: t('meta.loginDescription'),
      images: [`/og/login/${locale}.png`],
    },
  }
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
