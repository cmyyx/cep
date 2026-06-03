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
    title: t('nav.editor'),
    description: t('meta.editorDescription'),
    keywords: t('meta.editorKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'editor'),
    openGraph: {
      title: `${t('nav.editor')} - ${t('app.name')}`,
      description: t('meta.editorDescription'),
      images: [`/og/editor/${locale}.png`],
    },
  }
}

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
