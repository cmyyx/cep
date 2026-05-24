'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import ReactMarkdown from 'react-markdown'

const markdownComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-semibold tracking-tight mt-10 mb-3 text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-semibold mt-8 mb-2 text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed mb-3 text-muted-foreground">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 mb-4 space-y-1 text-sm text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm text-muted-foreground">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm text-muted-foreground">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-muted-foreground/70">{children}</em>
  ),
  hr: () => <hr className="my-8 border-border" />,
}

export default function PrivacyPage() {
  const t = useTranslations()

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('legal.privacyTitle')}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <article className="max-w-3xl mx-auto px-4 py-8">
          <ReactMarkdown components={markdownComponents}>
            {t('legal.privacyContent')}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
