'use client'

import { Fragment, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import glossaryData from '@/generated/data/wiki/rich-text.json'
import { hasGameI18n, lookupGameI18n } from '@/lib/game-i18n-catalogs'
import { parseWikiRichText, type WikiRichTextNode } from '@/lib/wiki-rich-text'
import { cn } from '@/lib/utils'
import { wikiTextKey } from '@/lib/wiki-i18n'
import type { WikiLocale, WikiRichTextTerm } from '@/types/wiki'

const glossary = glossaryData as Record<string, WikiRichTextTerm>

function asWikiLocale(locale: string): WikiLocale {
  if (locale === 'en' || locale === 'ja' || locale === 'zh-CN' || locale === 'zh-TW') {
    return locale
  }
  return 'zh-CN'
}

function styleClass(styleId: string) {
  if (/fire|burn/i.test(styleId)) return 'text-ship-red'
  if (/weak|vulnerable|down/i.test(styleId)) return 'text-preview-pink'
  if (/vup|pulse|cryst|natur|heal/i.test(styleId)) return 'text-develop-blue'
  return 'font-medium text-foreground'
}

function plainText(value: string) {
  return parseWikiRichText(value).map((node) => nodeText(node)).join('')
}

function nodeText(node: WikiRichTextNode): string {
  if (node.type === 'text') return node.text
  if (node.type === 'image') return ''
  return node.children.map(nodeText).join('')
}

function renderNodes(nodes: WikiRichTextNode[], translate: (key: string) => string): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === 'text') return <Fragment key={key}>{node.text}</Fragment>
    if (node.type === 'image') return null
    const children = renderNodes(node.children, translate)
    if (node.type === 'style') {
      return <span key={key} className={styleClass(node.id)}>{children}</span>
    }
    const term = glossary[node.id]
    if (!term) return <span key={key}>{children}</span>
    const name = translate(wikiTextKey('glossary', node.id, 'name'))
    const description = plainText(translate(wikiTextKey('glossary', node.id, 'description')))
    return (
      <Tooltip key={key}>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="link"
              size="card"
              className={cn(
                'inline h-auto min-w-0 align-baseline font-[inherit] text-[inherit] underline decoration-current/40 decoration-dotted underline-offset-2',
                styleClass(term.styleId)
              )}
            >
              {children}
            </Button>
          }
        />
        <TooltipContent className="block max-w-80 whitespace-pre-line py-2 leading-relaxed">
          <span className="block font-medium">{name}</span>
          <span className="mt-0.5 block text-background/80">{description}</span>
        </TooltipContent>
      </Tooltip>
    )
  })
}

export interface WikiRichTextProps {
  value: string
  className?: string
}
export function WikiRichText({ value, className }: WikiRichTextProps) {
  const locale = asWikiLocale(useLocale())
  const translate = (key: string) => {
    if (!hasGameI18n(locale, 'wikiData', key)) return key
    return lookupGameI18n(locale, 'wikiData', key) ?? key
  }
  return <span className={cn('whitespace-pre-line', className)}>{renderNodes(parseWikiRichText(value), translate)}</span>
}
