export interface BrowserInfo {
  browser: string
  engine: string
}

interface UserAgentRule {
  name: string
  pattern: string
  versionPattern?: string
}

const BROWSER_RULES: readonly UserAgentRule[] = [
  { name: 'Edge', pattern: '(?:EdgA|EdgiOS|Edg)/([\\d.]+)' },
  { name: 'Opera', pattern: '(?:OPR|OPT)/([\\d.]+)' },
  { name: 'Samsung Internet', pattern: 'SamsungBrowser/([\\d.]+)' },
  { name: 'Firefox', pattern: 'FxiOS/([\\d.]+)' },
  { name: 'Firefox', pattern: 'Firefox/([\\d.]+)' },
  { name: 'Chrome', pattern: 'CriOS/([\\d.]+)' },
  { name: 'Android WebView', pattern: '; wv\\).*?Chrome/([\\d.]+)' },
  { name: 'Chrome', pattern: 'Chrome/([\\d.]+)' },
  { name: 'Safari', pattern: 'Version/([\\d.]+).*Safari/' },
]

const ENGINE_RULES: readonly UserAgentRule[] = [
  {
    name: 'WebKit',
    pattern: '(?:iPhone|iPad|iPod)',
    versionPattern: 'AppleWebKit/([\\d.]+)',
  },
  {
    name: 'Gecko',
    pattern: 'Firefox/',
    versionPattern: 'rv:([\\d.]+)',
  },
  {
    name: 'Chromium',
    pattern: '(?:EdgA|Edg|OPR|SamsungBrowser|Chrome)/',
    versionPattern: 'Chrome/([\\d.]+)',
  },
  {
    name: 'WebKit',
    pattern: 'AppleWebKit/',
    versionPattern: 'AppleWebKit/([\\d.]+)',
  },
]

function detectProduct(userAgent: string, rules: readonly UserAgentRule[]): string {
  for (const rule of rules) {
    const match = new RegExp(rule.pattern).exec(userAgent)
    if (!match) continue

    const versionMatch = rule.versionPattern
      ? new RegExp(rule.versionPattern).exec(userAgent)
      : match
    return versionMatch?.[1] ? `${rule.name} ${versionMatch[1]}` : rule.name
  }

  return 'Unknown'
}

export function parseBrowserInfo(userAgent: string): BrowserInfo {
  return {
    browser: detectProduct(userAgent, BROWSER_RULES),
    engine: detectProduct(userAgent, ENGINE_RULES),
  }
}

function inlineRules(rules: readonly UserAgentRule[]): string {
  return JSON.stringify(rules)
}

/** ES5-compatible expression for early guards that run before React hydrates. */
export function buildBrowserInfoInlineCode(
  userAgentExpression = '(navigator.userAgent||"")',
): string {
  return `(function(ua){var B=${inlineRules(BROWSER_RULES)},E=${inlineRules(ENGINE_RULES)};function d(r){for(var i=0;i<r.length;i++){var x=r[i],m=new RegExp(x.pattern).exec(ua);if(!m)continue;var v=x.versionPattern?new RegExp(x.versionPattern).exec(ua):m;return x.name+(v&&v[1]?' '+v[1]:'')}return'Unknown'}return{browser:d(B),engine:d(E)}})(${userAgentExpression})`
}

export const BROWSER_INFO_INLINE_CODE = buildBrowserInfoInlineCode()
