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
    title: t('nav.characterGuide'),
  }
}

export default function CharacterGuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
