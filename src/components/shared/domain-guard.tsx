import { FEATURES } from '@/lib/features'
import { DEFAULT_SITE_URL } from '@/lib/constants'
import { BLOCK_SESSION_KEY } from '@/lib/block-state'

/**
 * Synchronous inline <head> guard code that runs before React hydration.
 * Blocked requests navigate to the localized Shadcn blocking page before
 * React starts; file:// builds redirect to the same page on the primary
 * official site because local static assets cannot hydrate reliably there.
 *
 * 组件形式已移除 (避免代码字符串随 RSC flight 重复序列化); 代码经
 * /guard-inline.js (src/app/guard-inline.js/route.ts) 由 postbuild 插入
 * 每个导出 html 的 <head>, 内联执行语义不变。
 */
export function buildDomainGuardCode(): string {
  const allowedDomainsJson = JSON.stringify(FEATURES.allowedDomains)
  const allowedEmbedDomainsJson = JSON.stringify(FEATURES.allowedEmbedDomains)
  const officialSite = (FEATURES.allowedDomains[0] ? `https://${FEATURES.allowedDomains[0]}` : DEFAULT_SITE_URL).replace(/\/$/, '')

  return `
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
