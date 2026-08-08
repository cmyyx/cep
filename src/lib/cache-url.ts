/** Append a content-derived cache version to a URL path without changing other query parameters. */
export type CacheVersionManifest = Readonly<Record<string, string>>

export function withCacheVersion(path: string, manifest: CacheVersionManifest): string {
  const queryIndex = path.indexOf('?')
  const fragmentIndex = path.indexOf('#')

  let pathEnd = path.length
  if (queryIndex !== -1) pathEnd = Math.min(pathEnd, queryIndex)
  if (fragmentIndex !== -1) pathEnd = Math.min(pathEnd, fragmentIndex)

  const rawPath = path.slice(0, pathEnd)
  let lookupPath = rawPath
  try {
    lookupPath = decodeURIComponent(rawPath)
  } catch {
    // Keep the raw path when it contains malformed percent encoding.
  }

  const version = manifest[lookupPath]
  if (!version) return path

  const fragmentStart = fragmentIndex === -1 ? path.length : fragmentIndex
  const beforeFragment = path.slice(0, fragmentStart)
  const fragment = path.slice(fragmentStart)
  const versionParam = `v=${encodeURIComponent(version)}`
  const existingQueryIndex = beforeFragment.indexOf('?')

  if (existingQueryIndex === -1) {
    return `${beforeFragment}?${versionParam}${fragment}`
  }

  const query = beforeFragment.slice(existingQueryIndex + 1)
  if (query === '') {
    return `${beforeFragment}${versionParam}${fragment}`
  }

  const parts = query.split('&')
  let replaced = false
  const nextParts = parts.map((part) => {
    const equalsIndex = part.indexOf('=')
    const key = equalsIndex === -1 ? part : part.slice(0, equalsIndex)
    if (key !== 'v') return part
    replaced = true
    return versionParam
  })

  if (replaced) {
    return `${beforeFragment.slice(0, existingQueryIndex + 1)}${nextParts.join('&')}${fragment}`
  }

  return `${beforeFragment}&${versionParam}${fragment}`
}
