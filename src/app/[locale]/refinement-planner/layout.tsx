import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  try {
    const messages = (await import(`../../../messages/${locale}.json`)).default
    return { title: messages.nav.refinementPlanner }
  } catch {
    return { title: 'Refinement Planner' }
  }
}

export default function RefinementPlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
