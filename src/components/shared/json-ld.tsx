import { HeadScript } from '@/components/shared/head-script'

export interface JsonLdProps {
  /** Fragment of the script id, e.g. "wiki-characters" → id="json-ld-wiki-characters". */
  id: string
  /** Plain JSON-LD object. Rendered as-is; `<` is escaped to keep the
   *  inline <script> from being closed early by entity names. */
  data: Record<string, unknown>
}

/**
 * Renders one JSON-LD block in <head>.
 *
 * Wraps HeadScript, which is the project's single sanctioned
 * `dangerouslySetInnerHTML` site: the payload is build-time data produced by
 * our own builders (src/lib/wiki-structured-data.ts), never user input.
 */
export function JsonLd({ id, data }: JsonLdProps) {
  return (
    <HeadScript
      id={`json-ld-${id}`}
      type="application/ld+json"
      code={JSON.stringify(data).replace(/</g, '\\u003c')}
    />
  )
}

export default JsonLd
