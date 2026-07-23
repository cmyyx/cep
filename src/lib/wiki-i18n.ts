function encodeWikiSegment(segment: string | number): string {
  return String(segment).replaceAll('.', '%2E')
}

export function wikiTextKey(...segments: Array<string | number>): string {
  return segments.map(encodeWikiSegment).join('|')
}
