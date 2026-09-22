import { DEFAULT_LOCALE, SUPPORTED_LOCALES, ZH_VARIANT_MAP } from '@/lib/locale-utils'

/**
 * Inline redirect for the root entry `/`.
 *
 * `app/page.tsx` used to be a client component that booted the whole React app
 * just to call `router.replace('/zh-CN')`: 18 chunks / 383 KB gzip before the
 * browser could even start the navigation, and a 2 s fallback timer that turned
 * a merely-slow RSC navigation into a full page reload on mobile networks.
 *
 * The redirect is now a synchronous inline script that runs before any
 * stylesheet or chunk request, so the entry costs one small HTML document.
 *
 * Locale resolution deliberately mirrors `detectBrowserLocale()` in
 * `locale-utils.ts` (exact match → Chinese variant table → prefix match →
 * default) and `getExplicitLanguage()` for the stored preference, and both
 * share the same tables — `root-redirect.test.ts` pins them together.
 */
export const ROOT_REDIRECT_SCRIPT = `(function(){try{` +
  `var S=${JSON.stringify(SUPPORTED_LOCALES)},` +
  `D=${JSON.stringify(DEFAULT_LOCALE)},` +
  `M=${JSON.stringify(Object.entries(ZH_VARIANT_MAP))},t=null,i;` +
  // Explicit preference from the settings store wins over browser detection.
  `try{var r=localStorage.getItem('cep-settings');` +
  `if(r){var p=JSON.parse(r);` +
  `if(p&&typeof p==='object'&&'language' in p){var l=p.language;` +
  `if(typeof l==='string'&&l!=='auto'&&S.indexOf(l)!==-1)t=l}}}catch(e){}` +
  `if(!t){` +
  `var n=(navigator.language||'')+'',lo=n.toLowerCase();` +
  // 1. exact match, case-insensitive
  `for(i=0;i<S.length;i++){if(S[i].toLowerCase()===lo){t=S[i];break}}` +
  // 2. Chinese variant table, scanned in insertion order
  `if(!t&&lo.indexOf('zh')===0){` +
  `for(i=0;i<M.length;i++){if(lo.indexOf(M[i][0])===0){t=M[i][1];break}}` +
  `if(!t)t=D}` +
  // 3. prefix match ("en-US" → "en")
  //
  // Uses the lowercased tag, matching `detectBrowserLocale()` in locale-utils.ts.
  // All three steps must be case-insensitive together: the exact-match and
  // Chinese-variant steps already are, so an upper-case language subtag such as
  // "JA-jp" has to resolve to "ja" here too rather than falling through to the
  // default. `root-redirect.test.ts` asserts both implementations agree across a
  // case matrix.
  `if(!t){var q=lo.split('-')[0];` +
  `for(i=0;i<S.length;i++){if(S[i].split('-')[0]===q){t=S[i];break}}` +
  `if(!t)t=D}` +
  `}` +
  // Query + hash are preserved, matching LocaleGuard and buildLocaleHref
  // (locale-utils.ts) so a shared link keeps its UTM params and anchor.
  `location.replace(location.origin+'/'+t+location.search+location.hash);` +
  `}catch(e){location.replace('/'+${JSON.stringify(DEFAULT_LOCALE)})}})()`
