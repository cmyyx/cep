import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const messages = (await import(`../../../messages/${locale}.json`)).default
  return {
    title: messages.nav.characterGuide,
  }
}

export default function CharacterGuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
