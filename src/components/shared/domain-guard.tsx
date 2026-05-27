import { HeadScript } from '@/components/shared/head-script'
import { FEATURES } from '@/lib/features'

/**
 * Injects a blocking inline <script> into <head> that runs before React hydration.
 * Detects unauthorized mirrors and iframe embeds, replacing the page
 * content with a bilingual warning if the current origin is not allowed.
 *
 * Uses a plain <script> with dangerouslySetInnerHTML (via HeadScript)
 * instead of next/script — it must live in <head> where React's hydration
 * root cannot reach it. Only emits the script when antiMirror or
 * antiEmbed is enabled at build time.
 */
export function DomainGuard() {
  if (!FEATURES.antiMirror && !FEATURES.antiEmbed) return null

  const allowedDomainsJson = JSON.stringify(FEATURES.allowedDomains)
  const allowedEmbedDomainsJson = JSON.stringify(FEATURES.allowedEmbedDomains)
  const officialDomains = FEATURES.allowedDomains.map((d) => `https://${d}`)
  const firstDomain = officialDomains[0] ?? ''

  // Build the guard snippet. Each guard section is only included if the
  // corresponding feature is enabled (dead-code elimination at build).
  const scriptBody = `
(function(){
  var host=location.hostname;
  if(host==='localhost'||host==='127.0.0.1')return;
  ${FEATURES.antiMirror ? buildMirrorSnippet(allowedDomainsJson, officialDomains) : ''}
  ${FEATURES.antiEmbed ? buildEmbedSnippet(allowedEmbedDomainsJson, firstDomain) : ''}
})();
`.trim()

  return <HeadScript id="domain-guard" code={scriptBody} />
}

function buildMirrorSnippet(allowedDomainsJson: string, officialDomains: string[]): string {
  const listHtml = officialDomains
    .map((d) => `<li style="margin:4px 0"><a href="${d}" style="color:#f87171;text-decoration:underline">${d}</a></li>`)
    .join('')

  // prettier-ignore
  return String.raw`
var allowed=[].concat(${allowedDomainsJson});
if(allowed.indexOf(host)===-1){
  document.documentElement.innerHTML='<head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Access Blocked</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{max-width:480px;background:#171717;border-radius:12px;padding:32px;box-shadow:0 0 0 1px rgba(255,255,255,0.08)}h1{font-size:20px;font-weight:600;margin-bottom:12px;color:#f87171}.domain{font-family:monospace;font-size:13px;color:#a1a1aa;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:4px;word-break:break-all}p{margin:8px 0;font-size:14px;line-height:1.6;color:#d4d4d8}ul{list-style:none;margin-top:8px}.divider{margin:24px 0 16px;border-top:1px solid rgba(255,255,255,0.08)}</style></head><body><div class=card><h1>\u8bbf\u95ee\u88ab\u963b\u6b62</h1><p>\u5f53\u524d\u57df\u540d\uff08<code class=domain>'+host+'</code>\uff09\u975e\u672c\u7ad9\u5b98\u65b9\u57df\u540d\u3002</p><p>\u8bf7\u8bbf\u95ee\u5b98\u65b9\u7ad9\u70b9\uff1a</p><ul>${listHtml}</ul><div class=divider></div><h1 style=color:#f87171>Access Blocked</h1><p>The domain (<code class=domain>'+host+'</code>) is not an official domain.</p><p>Please visit:</p><ul>${listHtml}</ul></div></body>';
  throw new Error('DOMAIN_BLOCKED');
}`.trim()
}

function buildEmbedSnippet(allowedEmbedDomainsJson: string, firstDomain: string): string {
  // prettier-ignore
  return String.raw`
if(window.self!==window.top){
  try{var parentHost=window.parent.location.hostname;}catch(e){}
  if(!parentHost){
    try{var refUrl=new URL(document.referrer);parentHost=refUrl.hostname;}catch(e){}
  }
  if(!parentHost)parentHost='\u672a\u77e5 / unknown';
  var embedAllowed=[].concat(${allowedEmbedDomainsJson});
  if(embedAllowed.indexOf(parentHost)===-1){
    document.documentElement.innerHTML='<head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Access Blocked</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{max-width:480px;background:#171717;border-radius:12px;padding:32px;box-shadow:0 0 0 1px rgba(255,255,255,0.08)}h1{font-size:20px;font-weight:600;margin-bottom:12px;color:#f87171}.domain{font-family:monospace;font-size:13px;color:#a1a1aa;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:4px;word-break:break-all}p{margin:8px 0;font-size:14px;line-height:1.6;color:#d4d4d8}a{color:#f87171;text-decoration:underline}.divider{margin:24px 0 16px;border-top:1px solid rgba(255,255,255,0.08)}</style></head><body><div class=card><h1>\u8bbf\u95ee\u88ab\u963b\u6b62</h1><p>\u672c\u7ad9\u4e0d\u5141\u8bb8\u88ab\u5d4c\u5165\u5176\u4ed6\u7f51\u7ad9\u3002</p><p>\u5d4c\u5165\u6765\u6e90\uff1a<code class=domain>'+parentHost+'</code></p><p>\u5982\u9700\u8bbf\u95ee\uff0c\u8bf7\u76f4\u63a5\u6253\u5f00 <a href=${firstDomain||'#'}>${firstDomain||'#'}</a></p><div class=divider></div><h1 style=color:#f87171>Access Blocked</h1><p>This site does not allow embedding.</p><p>Embedding source: <code class=domain>'+parentHost+'</code></p><p>Please visit <a href=${firstDomain||'#'}>${firstDomain||'#'}</a> directly.</p></div></body>';
    throw new Error('EMBED_BLOCKED');
  }
}`.trim()
}
