import { HeadScript } from '@/components/shared/head-script'
import { GUARD_OVERLAY_OPEN, GUARD_OVERLAY_CLOSE, GUARD_FEEDBACK_HTML } from '@/components/shared/guard-layout'

/**
 * Inline CSS load failure guard — injected into <head>.
 *
 * Detects when the application's CSS fails to load and shows a fallback UI.
 * Detection uses a CSS custom property sentinel (--cep-css-loaded) defined
 * in globals.css on :root. This is immune to false positives from
 * browser-injected stylesheets (e.g. Via browser's ad blocker CSS) because
 * those stylesheets don't define our sentinel variable.
 *
 * Timing is handled by two mechanisms:
 *   1. MutationObserver — tracks dynamically injected <link rel="stylesheet">
 *      elements (Turbopack loads CSS via JS after window.load). Each link's
 *      load/error event is monitored; the audit waits for all to settle.
 *   2. window.load — signals that initial HTML resources are done.
 *
 * The audit runs only after window.load has fired AND all tracked
 * stylesheets have settled (load or error). No custom timeout — the
 * browser's native <link> load/error behavior handles timeouts.
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
  '</button>'+
  GUARD_FEEDBACK_HTML

const CSS_GUARD_CODE = `(function(){
var F=[],_loadDone=false,_pending=0,_audited=false,_auditQueued=false;

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

/* Layer 2 — MutationObserver tracks dynamically injected <link> elements.
   Each load/error is monitored. Audit runs when all settle + window.load. */
function trackSheet(link){
  _pending++;
  var done=false;
  function settle(){
    if(done)return; done=true;
    _pending--;
    tryAudit();
  }
  link.addEventListener('load',settle,{once:true});
  link.addEventListener('error',function(){
    F.push({url:link.href||'',reason:'network'});
    settle();
  },{once:true});
  try{if(link.sheet)settle();}catch(e){}
}

function tryAudit(){
  if(_audited||_auditQueued||!_loadDone||_pending>0)return;
  _auditQueued=true;
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    _auditQueued=false;
    if(_audited||!_loadDone||_pending>0)return;
    _audited=true;
    runAudit();
  })});
}

window.addEventListener('load',function(){
  _loadDone=true;
  tryAudit();
});

if(document.readyState==='complete'){
  _loadDone=true;
  setTimeout(tryAudit,0);
}

var mo=new MutationObserver(function(muts){
  for(var i=0;i<muts.length;i++){
    var nodes=muts[i].addedNodes;
    for(var j=0;j<nodes.length;j++){
      var n=nodes[j];
      if(n.nodeType!==1)continue;
      if(n.tagName==='LINK'){
        var rel=n.getAttribute('rel');
        if(rel==='stylesheet')trackSheet(n);
      }
      var ch=n.querySelectorAll&&n.querySelectorAll('link[rel="stylesheet"]');
      if(ch)for(var k=0;k<ch.length;k++)trackSheet(ch[k]);
    }
  }
});
mo.observe(document.documentElement,{childList:true,subtree:true});

/* Audit — check CSS sentinel variable.
   --cep-css-loaded is defined in globals.css on :root.
   Browser-injected stylesheets don't define this variable. */
function runAudit(){
  try{
    var v=getComputedStyle(document.documentElement).getPropertyValue('--cep-css-loaded');
    if(v&&v.trim()==='1')return;
  }catch(e){}
  var S=[],L=document.querySelectorAll('link[rel="stylesheet"]');
  for(var i=0;i<L.length;i++)S.push({url:L[i].href||'',sheet:!!L[i].sheet});
  console.error('[CSS Guard] sentinel missing',JSON.stringify({failures:F,stylesheets:S,readyState:document.readyState}));
  show();
}

function show(){
  if(document.getElementById('cep-css-fatal'))return;
  var d=document.createElement('div');
  d.id='cep-css-fatal';
  d.innerHTML=${JSON.stringify(GUARD_OVERLAY_OPEN + CSS_CONTENT + GUARD_OVERLAY_CLOSE)};
  (document.body||document.documentElement).appendChild(d);
}
})()`.replace(/\n\s*/g, '')

export function CssGuard() {
  return <HeadScript id="css-guard" code={CSS_GUARD_CODE} />
}
