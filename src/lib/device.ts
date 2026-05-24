/**
 * Parse navigator.userAgent into a human-readable device name.
 * Only runs on client side.
 */
export function getDeviceName(): string | null {
  if (typeof window === 'undefined') return null

  const ua = navigator.userAgent
  let os = ''
  let browser = ''

  // OS
  if (/Windows NT 10/.test(ua)) os = 'Windows'
  else if (/Windows NT 6\.[3-9]/.test(ua)) os = 'Windows'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Linux/.test(ua) && !/Android/.test(ua)) os = 'Linux'
  else os = 'Unknown OS'

  // Browser
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\//.test(ua)) browser = 'Opera'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'
  else browser = 'Unknown Browser'

  // Detect mobile
  const isMobile = /Mobi|Android/i.test(ua)
  const prefix = isMobile ? '📱 ' : ''

  return `${prefix}${browser} on ${os}`
}
