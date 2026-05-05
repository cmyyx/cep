import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Background } from '@/components/background'
import { ThemeProvider } from '@/components/theme-provider'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const messages = (await import(`../../messages/${locale}.json`)).default
  return {
    title: {
      template: `%s - ${messages.app.name}`,
      default: messages.app.name,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  setRequestLocale(locale)

  const messages = (await import(`../../messages/${locale}.json`)).default

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <SidebarProvider>
        <ThemeProvider>
          <Background />
          <AppSidebar />
          <main className="flex-1 w-full">{children}</main>
        </ThemeProvider>
      </SidebarProvider>
    </NextIntlClientProvider>
  )
}
