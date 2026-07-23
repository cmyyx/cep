import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getAlternates } from '@/lib/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('nav.panelPreview'),
    description: t('meta.panelPreviewDescription'),
    keywords: t('meta.panelPreviewKeywords').split(',').map((key) => key.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'panel-preview'),
  }
}

export default function PanelPreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
