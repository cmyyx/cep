/**
 * Inline <head> script for static SSG.
 *
 * Uses dangerouslySetInnerHTML — this is the ONLY legitimate use case:
 * build-time scripts that must execute synchronously before hydration
 * (theme FOUC prevention, document language, etc.).
 *
 * NEVER use dangerouslySetInnerHTML anywhere else. NEVER pass
 * user-generated content into the `code` prop.
 */
export function HeadScript({ id, code, type }: { id: string; code: string; type?: string }) {
  return (
    <script
      id={id}
      type={type}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  )
}
