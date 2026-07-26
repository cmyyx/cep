/**
 * The custom background URL is user input that ends up in `<Image src>`; only accept
 * absolute http(s) URLs so `javascript:`, `data:` and typos never reach the renderer.
 */
export function isValidBackgroundUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const { protocol } = new URL(trimmed)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
