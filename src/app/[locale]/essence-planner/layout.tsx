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
    title: t('nav.essencePlanner'),
  }
}

export default function EssencePlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
