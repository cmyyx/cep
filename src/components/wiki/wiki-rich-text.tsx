'use client'

import { Fragment, type ReactNode } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import glossaryData from '@/generated/data/wiki/rich-text.json'
import { useGameI18nLocale } from '@/hooks/use-game-i18n-catalogs'
import { withImageCacheVersion } from '@/lib/image-url'
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

/**
 * 游戏文案内嵌图标 (<image="BuffIcon/icon_xx" scale=1.25>) 到本地静态资源的映射。
 * 前缀目录 -> public/images 下的产物目录 (同步管线 convert-icons.ts 的 bufficon 类别)。
 * 未知前缀返回 null, 保持旧行为 (不渲染)。
 */
const IMAGE_PATH_PREFIXES: Record<string, string> = {
  BuffIcon: '/images/wiki/bufficon',
}

function mapImagePath(path: string): string | null {
  const slash = path.indexOf('/')
  if (slash === -1) return null
  const prefix = path.slice(0, slash)
  const name = path.slice(slash + 1)
  const dir = IMAGE_PATH_PREFIXES[prefix]
  if (!dir || !name) return null
  return withImageCacheVersion(`${dir}/${name}.avif`)
}

function renderImage(node: Extract<WikiRichTextNode, { type: 'image' }>): ReactNode {
  const src = mapImagePath(node.path)
  if (!src) return null
  const size = Math.round(16 * node.scale)
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="inline-block align-[-0.15em] mx-0.5"
    />
  )
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

function renderNodes(nodes: WikiRichTextNode[], resolveTerm: TermResolver, interactive = true): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === 'text') return <Fragment key={key}>{node.text}</Fragment>
    if (node.type === 'image') return <Fragment key={key}>{renderImage(node)}</Fragment>
    const children = renderNodes(node.children, resolveTerm, interactive)
    if (node.type === 'style') {
      // tooltip 内部 (interactive=false): 不加 workflow 强调色 — Popup 底色是 bg-foreground,
      // styleClass 的 fallback (text-foreground) 在两种主题下都会与底色相同而不可读。
      if (!interactive) return <Fragment key={key}>{children}</Fragment>
      return <span key={key} className={styleClass(node.id)}>{children}</span>
    }
    const term = glossary[node.id]
    // tooltip 内部: 术语只作纯样式文字展示 (粗体区分, 不嵌套 tooltip 也不上色), 避免移出触发区即关闭
    if (!interactive || !term) return <span key={key} className={term && 'font-medium'}>{children}</span>
    const name = resolveTerm(node.id, term, 'name')
    const descriptionNodes = parseWikiRichText(resolveTerm(node.id, term, 'description'))
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
          <span className="mt-0.5 block text-background/80">{renderNodes(descriptionNodes, resolveTerm, false)}</span>
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
