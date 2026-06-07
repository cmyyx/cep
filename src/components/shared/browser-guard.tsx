import { HeadScript } from '@/components/shared/head-script'
import { BROWSER_DETECT_CODE, AVIF_PROBE_DATA } from '@/lib/browser-detect'
import { GUARD_OVERLAY_OPEN, GUARD_OVERLAY_CLOSE, GUARD_FEEDBACK_HTML } from '@/components/shared/guard-layout'

/**
 * Inline browser capability guard — injected into <head>.
 *
 * Phase 1 (sync): runs BROWSER_DETECT_CODE to check CSS/JS APIs.
 * Critical sync issues trigger an immediate upgrade overlay.
 *
 * Phase 2 (async): loads a 1x1 AVIF probe image to check AVIF
 * decoding support. If AVIF is unsupported the overlay is shown
 * after the async check completes.
 *
 * Detection logic lives in @/lib/browser-detect.ts (pure function + minified
 * IIFE). Tests are in @/lib/browser-detect.test.ts.
 */

/** Browser download links as inline HTML */
const BROWSER_LINKS =
  '<a href="https://www.google.com/chrome/" target="_blank" rel="noopener" style="color:#0a72ef;">Chrome 99+</a> / '+
  '<a href="https://www.mozilla.org/firefox/" target="_blank" rel="noopener" style="color:#0a72ef;">Firefox 97+</a> / '+
  '<a href="https://www.apple.com/safari/" target="_blank" rel="noopener" style="color:#0a72ef;">Safari 16.0+</a> / '+
  '<a href="https://www.microsoft.com/edge" target="_blank" rel="noopener" style="color:#0a72ef;">Edge 99+</a>'

const BROWSER_GUARD_CODE = `(function(){
function showOverlay(missing){
  if(document.getElementById('cep-browser-warn'))return;
  var d=document.createElement('div');
  d.id='cep-browser-warn';
  d.innerHTML=${JSON.stringify(GUARD_OVERLAY_OPEN)}+
    '<h2 style="font-size:16px;font-weight:500;margin:0;color:#171717;">\\u6D4F\\u89C8\\u5668\\u7248\\u672C\\u8FC7\\u65E7</h2>'+
    '<p style="color:#555;max-width:420px;line-height:1.6;margin:0;">'+
    '\\u60A8\\u5F53\\u524D\\u7684\\u6D4F\\u89C8\\u5668\\u7F3A\\u5C11\\u5FC5\\u8981\\u529F\\u80FD\\uFF0C'+
    '\\u53EF\\u80FD\\u65E0\\u6CD5\\u6B63\\u5E38\\u663E\\u793A\\u9875\\u9762\\u3002'+
    '<br><br>'+
    '\\u8BF7\\u5347\\u7EA7\\u5230\\u6700\\u65B0\\u7248\\u672C\\u4EE5\\u83B7\\u5F97\\u5B8C\\u6574\\u4F53\\u9A8C\\u3002'+
    '<br>'+
    '<strong>\\u63A8\\u8350\\uFF1A</strong>${BROWSER_LINKS}</p>'+
    '<p style="font-size:13px;color:#999;max-width:420px;">'+
    'Your browser is outdated and lacks required features.<br>'+
    'Please upgrade to ${BROWSER_LINKS}.</p>'+
    (true?
      '<p style="font-size:13px;color:#cc3333;max-width:380px;margin-top:8px;">'+
      '\\u7F3A\\u5931\\u5173\\u952E\\u529F\\u80FD\\uFF1A'+
      '<code style="font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:3px;">'+missing.join(', ')+'</code>'+
      '<br>Missing critical features: <code style="font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:3px;">'+missing.join(', ')+'</code>'+
      '</p>'
    :'')+
    ${JSON.stringify(GUARD_FEEDBACK_HTML)}+
    ${JSON.stringify(GUARD_OVERLAY_CLOSE)};
  (document.body||document.documentElement).appendChild(d);
}

/* Phase 1: sync CSS / JS API checks */
var issues=${BROWSER_DETECT_CODE};
if(issues.length>0){
  var critical=issues.indexOf('CSS_API')>=0||issues.indexOf('CSS_VARS')>=0||issues.indexOf('CSS_WHERE')>=0;
  if(critical){ showOverlay(issues); return; }
}

/* Phase 2: async AVIF decode check */
var img=new Image();
img.onload=function(){ if(!(img.width>0&&img.height>0)) showOverlay(['AVIF']); };
img.onerror=function(){ showOverlay(['AVIF']); };
img.src=${JSON.stringify(AVIF_PROBE_DATA)};
})();`.replace(/\n\s*/g, '')

export function BrowserGuard() {
  return <HeadScript id="browser-guard" code={BROWSER_GUARD_CODE} />
}
