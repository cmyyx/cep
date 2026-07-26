'use client'

import { Fragment, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import glossaryData from '@/generated/data/wiki/rich-text.json'
import { useGameI18nLocale } from '@/hooks/use-game-i18n-catalogs'
import { parseWikiRichText, type WikiRichTextNode } from '@/lib/wiki-rich-text'
import { cn } from '@/lib/utils'
import { asWikiLocale } from '@/lib/wiki-locale'
import { wikiTextKey } from '@/lib/wiki-i18n'
import type { WikiLocale, WikiRichTextTerm } from '@/types/wiki'

const glossary = glossaryData as Record<string, WikiRichTextTerm>

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

export type TermField = 'name' | 'description'
type TermResolver = (id: string, term: WikiRichTextTerm, field: TermField) => string

/**
 * The wikiData catalog chunk loads asynchronously; until then (or if a term is missing
 * from it) fall back to the glossary entry's own localized text instead of showing the
 * raw `glossary|...` lookup key.
 */
export function resolveGlossaryText(
  term: WikiRichTextTerm,
  field: TermField,
  locale: WikiLocale,
  catalogMessage: unknown,
): string {
  if (typeof catalogMessage === 'string' && catalogMessage) return catalogMessage
  return term[field][locale] || term[field]['zh-CN'] || ''
}

function renderNodes(nodes: WikiRichTextNode[], resolveTerm: TermResolver): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === 'text') return <Fragment key={key}>{node.text}</Fragment>
    if (node.type === 'image') return null
    const children = renderNodes(node.children, resolveTerm)
    if (node.type === 'style') {
      return <span key={key} className={styleClass(node.id)}>{children}</span>
    }
    const term = glossary[node.id]
    if (!term) return <span key={key}>{children}</span>
    const name = resolveTerm(node.id, term, 'name')
    const description = plainText(resolveTerm(node.id, term, 'description'))
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
  const catalogs = useGameI18nLocale(locale)
  const resolveTerm = (id: string, term: WikiRichTextTerm, field: TermField): string =>
    resolveGlossaryText(term, field, locale, catalogs?.wikiData[wikiTextKey('glossary', id, field)])
  return <span className={cn('whitespace-pre-line', className)}>{renderNodes(parseWikiRichText(value), resolveTerm)}</span>
}
