import { HeadScript } from '@/components/shared/head-script'
import { FEATURES } from '@/lib/features'

/**
 * Injects a synchronous inline <script> into <head> that runs before React
 * hydration. HTTP(S) blocks navigate to a static blocking page before React
 * starts; file:// blocks render a static message in the current document. This
 * avoids relying on an overlay inside React-managed DOM, which React can remove
 * during hydration recovery.
 */
export function DomainGuard() {
  if (!FEATURES.antiMirror && !FEATURES.antiEmbed) return null

  const allowedDomainsJson = JSON.stringify(FEATURES.allowedDomains)
  const allowedEmbedDomainsJson = JSON.stringify(FEATURES.allowedEmbedDomains)
  const officialDomains = FEATURES.allowedDomains.map((d) => `https://${d}`)

  const scriptBody = `
(function(){
  var host=location.hostname;
  ${buildFileProtocolSnippet(officialDomains)}
  ${FEATURES.antiMirror ? buildMirrorSnippet(allowedDomainsJson) : ''}
  ${FEATURES.antiEmbed ? buildEmbedSnippet(allowedEmbedDomainsJson) : ''}
})();
`.trim()

  return <HeadScript id="domain-guard" code={scriptBody} />
}

function buildConsoleError(errorCode: string): string {
  return `console.error(new Error(${JSON.stringify(errorCode)}));`
}

function buildRedirectBlock(errorCode: string, target: string): string {
  const encodedTarget = JSON.stringify(target)
  return buildConsoleError(errorCode) + `location.replace(${encodedTarget});`
}

function buildFileProtocolBlock(bodyHtml: string, errorCode: string): string {
  const html =
    '<!doctype html><html lang="zh-CN"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>Access Blocked</title>' +
    '</head><body><main>' +
    bodyHtml +
    '</main></body></html>'
  const encodedHtml = JSON.stringify(html).replace(/<\//g, '<\\/')

  return (
    buildConsoleError(errorCode) +
    `var _p=${encodedHtml};` +
    'document.open();document.write(_p);document.close();' +
    'if(window.stop)window.stop();'
  )
}

function escapeHtml(value: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return value.replace(/[&<>"']/g, (ch) => map[ch] ?? ch)
}

function buildDomainListHtml(officialDomains: string[]): string {
  if (officialDomains.length === 0) {
    return '<li><code>Official domains are not configured.</code></li>'
  }

  return officialDomains
    .map((d) => {
      const safe = escapeHtml(d)
      return `<li><a href="${safe}">${safe}</a></li>`
    })
    .join('')
}

function buildFileProtocolSnippet(officialDomains: string[]): string {
  const listHtml = buildDomainListHtml(officialDomains)
  return String.raw`
if(location.protocol==='file:'){
  ${buildFileProtocolBlock(
    '<h1>访问被阻止</h1>' +
      '<p>CEP 终末地规划器不能直接通过 file:// 打开 HTML 文件。</p>' +
      '<p>请通过 Web 服务器访问静态构建产物，或直接访问官方站点：</p>' +
      '<ul>' + listHtml + '</ul>' +
      '<hr>' +
      '<h1>File Access Blocked</h1>' +
      '<p>CEP Endfield Planner cannot be opened directly through file:// HTML files.</p>' +
      '<p>Please serve the static build through a web server, or visit an official site:</p>' +
      '<ul>' + listHtml + '</ul>',
    'FILE_PROTOCOL_BLOCKED'
  )}
  return;
}`.trim()
}

function buildMirrorSnippet(allowedDomainsJson: string): string {
  return String.raw`
var allowed=[].concat(${allowedDomainsJson});
if(allowed.indexOf(host)===-1){
  ${buildRedirectBlock('DOMAIN_BLOCKED', '/blocked.html')}
  return;
}`.trim()
}

function buildEmbedSnippet(allowedEmbedDomainsJson: string): string {
  return String.raw`
if(window.self!==window.top){
  try{var parentHost=window.parent.location.hostname;}catch(e){}
  if(!parentHost){
    try{var refUrl=new URL(document.referrer);parentHost=refUrl.hostname;}catch(e){}
  }
  if(!parentHost)parentHost='unknown';
  var embedAllowed=[].concat(${allowedEmbedDomainsJson});
  if(embedAllowed.indexOf(parentHost)===-1){
    ${buildRedirectBlock('EMBED_BLOCKED', '/blocked.html')}
    return;
  }
}`.trim()
}
