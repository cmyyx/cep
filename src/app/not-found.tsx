import { NotFoundPage } from '@/components/shared/not-found-page'
import { versionData } from '@/generated/version-data'
import { NOT_FOUND_PANELS } from '@/lib/not-found-copy'

/**
 * The single static 404 document used by static hosts for every unmatched URL.
 *
 * Locale copy is extracted from the JSON messages at build time and passed as
 * small serializable props to the client boundary. The resulting HTML already
 * contains the text, so no runtime message request is needed for no-JS users.
 */
export default function NotFound() {
  return <NotFoundPage panels={NOT_FOUND_PANELS} versionInfo={versionData} />
}
