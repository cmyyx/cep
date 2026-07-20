import { HeadScript } from '@/components/shared/head-script'
import { FEATURES } from '@/lib/features'
import { DEFAULT_SITE_URL } from '@/lib/constants'
import { BLOCK_SESSION_KEY } from '@/lib/block-state'

/**
 * Injects a synchronous inline <script> into <head> that runs before React
 * hydration. Blocked requests navigate to the localized Shadcn blocking page
 * before React starts; file:// builds redirect to the same page on the primary
 * official site because local static assets cannot hydrate reliably there.
 */
export function DomainGuard() {

  const allowedDomainsJson = JSON.stringify(FEATURES.allowedDomains)
  const allowedEmbedDomainsJson = JSON.stringify(FEATURES.allowedEmbedDomains)
  const officialSite = (FEATURES.allowedDomains[0] ? `https://${FEATURES.allowedDomains[0]}` : DEFAULT_SITE_URL).replace(/\/$/, '')

  const scriptBody = `
(function(){
  var path=location.pathname;
  var blockedPath=path.endsWith('/blocked')||path.endsWith('/blocked/')||path.endsWith('/blocked.html')||path.endsWith('/blocked.html/');
  if(blockedPath)return;
  var blockedReason='';try{blockedReason=sessionStorage.getItem(${JSON.stringify(BLOCK_SESSION_KEY)})||'';}catch(e){}
  if(blockedReason){${buildRedirectBlock('BLOCK_STATE_ENFORCED')}return;}
  var host=location.hostname;
  ${buildFileProtocolSnippet(officialSite)}
  ${FEATURES.antiMirror ? buildMirrorSnippet(allowedDomainsJson) : ''}
  ${FEATURES.antiEmbed ? buildEmbedSnippet(allowedEmbedDomainsJson) : ''}
})();
`.trim()

  return <HeadScript id="domain-guard" code={scriptBody} />
}

function buildConsoleError(errorCode: string): string {
  return `console.error(new Error(${JSON.stringify(errorCode)}));`
}

function buildRedirectBlock(errorCode: string, origin = ''): string {
  return buildConsoleError(errorCode) +
    `try{if(!sessionStorage.getItem(${JSON.stringify(BLOCK_SESSION_KEY)}))sessionStorage.setItem(${JSON.stringify(BLOCK_SESSION_KEY)},${JSON.stringify(errorCode)});}catch(e){}` +
    "var _s=location.pathname.split('/'),_l=['zh-CN','zh-TW','ja','en'].indexOf(_s[1])>=0?_s[1]:'zh-CN';" +
    `location.replace(${JSON.stringify(origin)}+'/'+_l+'/blocked');`
}

function buildFileProtocolSnippet(officialSite: string): string {
  return String.raw`
if(location.protocol==='file:'){
  ${buildRedirectBlock('FILE_PROTOCOL_BLOCKED', officialSite)}
  return;
}`.trim()
}

function buildMirrorSnippet(allowedDomainsJson: string): string {
  return String.raw`
var allowed=[].concat(${allowedDomainsJson});
if(allowed.indexOf(host)===-1){
  ${buildRedirectBlock('DOMAIN_BLOCKED')}
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
    ${buildRedirectBlock('EMBED_BLOCKED')}
    return;
  }
}`.trim()
}
