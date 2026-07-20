'use client'

import { Fragment, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import glossaryData from '@/generated/data/wiki/rich-text.json'
import { parseWikiRichText, type WikiRichTextNode } from '@/lib/wiki-rich-text'
import { cn } from '@/lib/utils'
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

function renderNodes(nodes: WikiRichTextNode[], locale: WikiLocale): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === 'text') return <Fragment key={key}>{node.text}</Fragment>
    if (node.type === 'image') return null
    const children = renderNodes(node.children, locale)
    if (node.type === 'style') {
      return <span key={key} className={styleClass(node.id)}>{children}</span>
    }
    const term = glossary[node.id]
    if (!term) return <span key={key}>{children}</span>
    const name = term.name[locale] || term.name['zh-CN']
    const description = plainText(term.description[locale] || term.description['zh-CN'])
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
  const locale = useLocale() as WikiLocale
  return <span className={cn('whitespace-pre-line', className)}>{renderNodes(parseWikiRichText(value), locale)}</span>
}
