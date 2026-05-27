import { HeadScript } from '@/components/shared/head-script'
import { FEATURES } from '@/lib/features'

/**
 * Injects a blocking inline <script> into <head> that runs before React hydration.
 * Detects unauthorized mirrors and iframe embeds, replacing the page
 * content with a bilingual warning if the current origin is not allowed.
 *
 * Uses a closed Shadow DOM overlay — React cannot access or reconcile its
 * internal content. The underlying body is also disabled (pointer-events,
 * user-select, overflow) so removing the overlay via DevTools doesn't
 * restore page interactivity.
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
  ${buildFileProtocolSnippet(officialDomains)}
  ${FEATURES.antiMirror ? buildMirrorSnippet(allowedDomainsJson, officialDomains) : ''}
  ${FEATURES.antiEmbed ? buildEmbedSnippet(allowedEmbedDomainsJson, firstDomain) : ''}
})();
`.trim()

  return <HeadScript id="domain-guard" code={scriptBody} />
}

// CSS shared by all blocking pages. Written inside Shadow DOM's <style>,
// which is created at runtime — not present in the built HTML, so Next.js's
// HTML optimizer cannot inject <script noModule> after </style>.
const BLOCKING_CSS =
  '*{margin:0;padding:0;box-sizing:border-box}' +
  ':host{display:flex;align-items:center;justify-content:center;background:#0a0a0a;padding:24px}' +
  '.card{max-width:480px;background:#171717;border-radius:12px;padding:32px;box-shadow:0 0 0 1px rgba(255,255,255,0.08)}' +
  'h1{font-size:20px;font-weight:600;margin-bottom:12px;color:#f87171}' +
  '.domain{font-family:monospace;font-size:13px;color:#a1a1aa;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:4px;word-break:break-all}' +
  'p{margin:8px 0;font-size:14px;line-height:1.6;color:#d4d4d8}' +
  'a{color:#f87171;text-decoration:underline}' +
  'ul{list-style:none;margin-top:8px}' +
  'li{margin:4px 0}' +
  'code{font-size:13px}' +
  '.divider{margin:24px 0 16px;border-top:1px solid rgba(255,255,255,0.08)}'

/**
 * Build JS code that creates a closed Shadow DOM overlay covering the
 * entire viewport, then disables all interaction on the underlying body.
 *
 * The overlay is immune to React hydration (Shadow DOM is opaque) and
 * disabling body pointer-events/user-select prevents interaction even if
 * the overlay host element is removed via DevTools.
 */
function buildBlockingOverlay(bodyHtml: string): string {
  // The BLOCKING_CSS constant is inlined at build time via template literal.
  return (
    "var _h=document.createElement('div');" +
    "_h.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:auto';" +
    "var _s=_h.attachShadow({mode:'closed'});" +
    "_s.innerHTML='<style>" +
    BLOCKING_CSS +
    "</style><div class=card>" +
    bodyHtml +
    "</div>';" +
    "document.documentElement.appendChild(_h);" +
    "var _a=function(){var _b=document.body;_b.style.pointerEvents='none';_b.style.userSelect='none';_b.style.overflow='hidden'};" +
    "if(document.body)_a();else document.addEventListener('DOMContentLoaded',_a);"
  )
}

function buildDomainListHtml(officialDomains: string[]): string {
  return officialDomains
    .map(
      (d) =>
        `<li><a href="${d}">${d}</a></li>`
    )
    .join('')
}

function buildFileProtocolSnippet(officialDomains: string[]): string {
  const listHtml = buildDomainListHtml(officialDomains)
  // prettier-ignore
  return String.raw`
if(location.protocol==='file:'){
  ${buildBlockingOverlay(
    '<h1>\u65e0\u6cd5\u901a\u8fc7\u6587\u4ef6\u8bbf\u95ee</h1>' +
    '<p>CEP \u7ec8\u672b\u5730\u89c4\u5212\u5668\u9700\u8981\u901a\u8fc7 Web \u670d\u52a1\u5668\u8bbf\u95ee\uff0c\u4e0d\u652f\u6301\u76f4\u63a5\u53cc\u51fb HTML \u6587\u4ef6\u6253\u5f00\u3002</p>' +
    '<p>\u8bf7\u8bbf\u95ee\u5b98\u65b9\u7ad9\u70b9\uff1a</p>' +
    '<ul>' + listHtml + '</ul>' +
    '<div class=divider></div>' +
    '<h1>Cannot access via file://</h1>' +
    '<p>CEP Endfield Planner requires a web server. Opening HTML files directly is not supported.</p>' +
    '<p>Please visit:</p>' +
    '<ul>' + listHtml + '</ul>'
  )}
}`.trim()
}

function buildMirrorSnippet(allowedDomainsJson: string, officialDomains: string[]): string {
  const listHtml = buildDomainListHtml(officialDomains)
  // host is a runtime variable in the generated script — use string
  // concatenation to embed it into the innerHTML literal.
  // prettier-ignore
  return String.raw`
var allowed=[].concat(${allowedDomainsJson});
if(allowed.indexOf(host)===-1){
  ${buildBlockingOverlay(
    '<h1>\u8bbf\u95ee\u88ab\u963b\u6b62</h1>' +
    '<p>\u5f53\u524d\u57df\u540d\uff08<code class=domain>' + "'+host+'" + '</code>\uff09\u975e\u672c\u7ad9\u5b98\u65b9\u57df\u540d\u3002</p>' +
    '<p>\u8bf7\u8bbf\u95ee\u5b98\u65b9\u7ad9\u70b9\uff1a</p>' +
    '<ul>' + listHtml + '</ul>' +
    '<p>\u8bf7\u52ff\u5728\u672a\u7ecf\u6388\u6743\u7684\u60c5\u51b5\u4e0b\u955c\u50cf\u672c\u7ad9\u3002</p>' +
    '<div class=divider></div>' +
    '<h1>Access Blocked</h1>' +
    '<p>The domain (<code class=domain>' + "'+host+'" + '</code>) is not an official domain.</p>' +
    '<p>Please visit:</p>' +
    '<ul>' + listHtml + '</ul>' +
    '<p>Please do not mirror this site without authorization.</p>'
  )}
  throw new Error('DOMAIN_BLOCKED');
}`.trim()
}

function buildEmbedSnippet(allowedEmbedDomainsJson: string, firstDomain: string): string {
  const fd = firstDomain || '#'
  // parentHost is a runtime variable — same escaping as host above.
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
    ${buildBlockingOverlay(
      '<h1>\u8bbf\u95ee\u88ab\u963b\u6b62</h1>' +
      '<p>\u672c\u7ad9\u4e0d\u5141\u8bb8\u88ab\u5d4c\u5165\u5176\u4ed6\u7f51\u7ad9\u3002</p>' +
      '<p>\u5d4c\u5165\u6765\u6e90\uff1a<code class=domain>' + "'+parentHost+'" + '</code></p>' +
      '<p>\u5982\u9700\u8bbf\u95ee\uff0c\u8bf7\u76f4\u63a5\u6253\u5f00 <a href=' + fd + '>' + fd + '</a></p>' +
      '<p>\u8bf7\u52ff\u5728\u672a\u7ecf\u6388\u6743\u7684\u60c5\u51b5\u4e0b\u5d4c\u5165\u672c\u7ad9\u3002</p>' +
      '<div class=divider></div>' +
      '<h1>Access Blocked</h1>' +
      '<p>This site does not allow embedding.</p>' +
      '<p>Embedding source: <code class=domain>' + "'+parentHost+'" + '</code></p>' +
      '<p>Please visit <a href=' + fd + '>' + fd + '</a> directly.</p>' +
      '<p>Please do not embed this site without authorization.</p>'
    )}
    throw new Error('EMBED_BLOCKED');
  }
}`.trim()
}
