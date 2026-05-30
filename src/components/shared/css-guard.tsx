import { HeadScript } from '@/components/shared/head-script'
import { GUARD_OVERLAY_OPEN, GUARD_OVERLAY_CLOSE } from '@/components/shared/guard-layout'

/**
 * Inline CSS load failure guard — injected into <head>.
 *
 * Detects when CSS <link> resources fail to load (network error, 404,
 * blocked by extension) and shows a fallback UI. Uses only browser
 * lifecycle events — no setTimeout, no polling:
 *
 *   1. capture-phase `error` listener on <link rel="stylesheet">
 *   2. `window.load` → audit document.styleSheets.cssRules
 *
 * The fallback is pure inline HTML with zero external dependencies,
 * so it works even when every CSS and JS file fails.
 */

const CSS_CONTENT =
  '<h2 style="font-size:16px;font-weight:500;margin:0;color:#171717;">\u6837\u5F0F\u52A0\u8F7D\u5931\u8D25</h2>'+
  '<p style="color:#666;max-width:400px;line-height:1.6;margin:0;">\u9875\u9762\u6837\u5F0F\u8D44\u6E90\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u91CD\u8BD5\u3002</p>'+
  '<p style="font-size:13px;color:#999;margin:0;">Style resources failed to load. Please refresh the page.</p>'+
  '<button onclick="location.reload()" '+
  'style="margin-top:8px;padding:10px 32px;border:none;border-radius:6px;'+
  'background:#171717;color:#fff;font-size:15px;cursor:pointer;'+
  'font-family:system-ui,sans-serif;">'+
  '\u5237\u65B0\u9875\u9762 Refresh'+
  '</button>'

const CSS_GUARD_CODE = `(function(){
var F=[];

/* Layer 1 — network errors on <link rel="stylesheet"> */
document.addEventListener('error',function(e){
  var t=e.target;
  if(t&&t.tagName==='LINK'){
    var r=t.getAttribute('rel');
    if(r==='stylesheet'||(t.rel==='stylesheet')){
      F.push({url:t.href||'',reason:'network'});
    }
  }
},true);

/* Layer 2 — window.load: all resources settled. Audit styleSheets. */
window.addEventListener('load',function(){
  var has=false,empty=[];
  for(var i=0;i<document.styleSheets.length;i++){
    var s=document.styleSheets[i];
    if(!s||!s.href)continue;
    try{
      var r=s.cssRules;
      if(!r||r.length===0){empty.push(s.href);}
      else{has=true;}
    }catch(e){empty.push(s.href);}
  }
  for(var j=0;j<empty.length;j++)F.push({url:empty[j],reason:'empty-or-unparseable'});

  if(!has||F.length>0)show();
});

function show(){
  if(document.getElementById('cep-css-fatal'))return;
  var d=document.createElement('div');
  d.id='cep-css-fatal';
  d.innerHTML=${JSON.stringify(GUARD_OVERLAY_OPEN + CSS_CONTENT + GUARD_OVERLAY_CLOSE)};
  (document.body||document.documentElement).appendChild(d);
}
})();`.replace(/\n\s*/g, '')

export function CssGuard() {
  return <HeadScript id="css-guard" code={CSS_GUARD_CODE} />
}
