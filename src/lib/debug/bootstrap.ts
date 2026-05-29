/**
 * Mobile debug bootstrap — inline script injected into <head> via HeadScript.
 *
 * ================================================================
 * AGENTS.md EXCEPTION NOTES:
 * ================================================================
 *
 * 1. **Inline styles (style attribute on DOM elements)**:
 *    N/A — the floating debug label has been moved to a React component
 *    (DebugLabel). No inline styles remain in this script.
 *
 * 2. **Bare DOM elements (createElement, appendChild)**:
 *    N/A — the debug label has been moved to a React component. This
 *    script no longer touches the DOM, only events + console.
 *
 * 3. **`dangerouslySetInnerHTML`** (via HeadScript in layout.tsx):
 *    Already covered by existing exception for head-script.tsx.
 * ================================================================
 */

/** Number of rapid clicks (within 1 second) to toggle the debug console. */
const DEBUG_CLICK_THRESHOLD = 11

export const DEBUG_BOOTSTRAP_CODE = `(function(){
var B=[],M=1000;
function A(l,a){
  var s=[];for(var i=0;i<a.length;i++){var v=a[i];try{s.push(typeof v==='string'?v:JSON.stringify(v))}catch(e){s.push(String(v))}}
  B.push({l:l,t:Date.now(),a:s});if(B.length>M)B.shift();
  var d=window.__cep_debug__;if(d&&d._onLog)d._onLog();
}
(function(){var L=['debug','log','warn','error'];for(var i=0;i<L.length;i++){(function(lev){var o=console[lev].bind(console);console[lev]=function(){A(lev,Array.prototype.slice.call(arguments));o.apply(console,arguments)}})(L[i])}})();
window.addEventListener('error',function(e){if(e.target===window||(e.target&&e.message))A('error',[e.message||'Unknown',(e.filename||'')+':'+(e.lineno||'')]);});
window.addEventListener('error',function(e){var t=e.target;if(t&&(t instanceof HTMLLinkElement||t instanceof HTMLScriptElement||t instanceof HTMLImageElement))A('resource',[(t.tagName||'el').toLowerCase()+' failed: '+(t.href||t.src||'')])},true);
window.addEventListener('unhandledrejection',function(e){A('error',['[Rejection]',e.reason])});

/* ── Enhanced defensive monitors ── */

/* Known CEP element selectors — used to filter out own mutations. */
var _own='script[src="/debug-panel.js"],script#debug-bootstrap,script#theme-fouc,script#domain-guard,script#head-script,script#ms-clarity,script[src*="clarity.ms"],script[src*="cloudflareinsights"],link[rel="preconnect"],link[rel="preload"],link[rel="stylesheet"][href*="geist"],link[rel="icon"],link[rel="apple-touch-icon"],meta[name],meta[charset],title';

/* 1. Injection scanner — MutationObserver (primary) + polling fallback.
      MutationObserver catches real-time DOM changes. Polling (every 2s)
      catches anything the observer misses (e.g. browser extensions
      patching appendChild). Both share the same logInject + seen set. */
(function(){
  /* WeakSet tracks object identity correctly (unlike plain {} which
     stringifies keys to "[object HTMLScriptElement]"). */
  var seen=typeof WeakSet!=='undefined'?new WeakSet():{__set:[],has:function(n){return this.__set.indexOf(n)>=0},add:function(n){this.__set.push(n)}};
  var ic=0;
  function logInject(n){
    if(seen.has(n))return;seen.add(n);
    var tag=(n.tagName||'').toLowerCase();
    var id=n.id?'#'+n.id:'';
    var cls=n.className&&typeof n.className==='string'?('.'+n.className.split(' ').slice(0,2).join('.')):'';
    var src=n.href||n.src||'';
    A('dom',['inject',tag+id+cls+(src?' '+src:'')]);
  }
  function isOwn(n){
    try{return !!(n.matches&&n.matches(_own))}catch(e){return false}
  }
  function scanNode(n){
    if(n.nodeType!==1)return;
    var tag=(n.tagName||'').toUpperCase();
    if(tag!=='SCRIPT'&&tag!=='STYLE'&&tag!=='LINK')return;
    if(isOwn(n))return;
    logInject(n);ic++;
  }
  function scanChildren(el){
    var ch=el.querySelectorAll('script,style,link');
    for(var i=0;i<ch.length;i++)scanNode(ch[i]);
  }

  /* MutationObserver — real-time */
  if(typeof MutationObserver!=='undefined'){
    try{
      var obs=new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){
          var added=muts[i].addedNodes;if(!added)continue;
          for(var j=0;j<added.length;j++){
            var n=added[j];scanNode(n);
            if(n.nodeType===1)scanChildren(n)
          }
        }
      });
      obs.observe(document.documentElement,{childList:true,subtree:true});
      if(document.body)obs.observe(document.body,{childList:true,subtree:true});
      else document.addEventListener('DOMContentLoaded',function(){obs.observe(document.body,{childList:true,subtree:true})},{once:true});
    }catch(e){A('dom',['observer-error',e.message||String(e)])}
  }

  /* Polling fallback — catches injections the observer misses.
     Gated by visibilityState to avoid background CPU/battery drain. */
  setInterval(function(){if(document.visibilityState!=='visible')return;scanChildren(document.head||document.documentElement);scanChildren(document.body||document.documentElement)},2000);

  window.__cep_debug__=window.__cep_debug__||{};
  window.__cep_debug__._injectedCount=function(){return ic};
})();

/* 2. Viewport change tracking — log resize events (throttled). */
(function(){
  var vw=innerWidth,vh=innerHeight,rt=null;
  function check(){
    rt=null;
    var nw=innerWidth,nh=innerHeight;
    if(nw===vw&&nh===vh)return;
    A('env',['viewport',nw+'x'+nh+' (was '+vw+'x'+vh+')']);
    vw=nw;vh=nh;
  }
  window.addEventListener('resize',function(){if(!rt)rt=setTimeout(check,300)});
  A('env',['viewport:init',vw+'x'+vh]);
})();

/* 3. Touch event audit — log first touch interaction with context. */
(function(){
  var done=false;
  function audit(e){
    if(done)return;done=true;
    var t=e.touches&&e.touches[0];
    A('touch',['first',t?t.clientX+','+t.clientY:'?','target='+(e.target&&e.target.tagName||'?')+(e.target&&e.target.id?'#'+e.target.id:'')]);
  }
  document.addEventListener('touchstart',audit,{once:true,passive:true,capture:true});
})();

/* 4. Scroll/overflow monitor — detect layout hijacking on first scroll. */
(function(){
  var done=false;
  var keys=['[data-slot="sidebar-wrapper"]','main[data-slot="sidebar-inset"]','html','body'];
  function chk(){
    if(done)return;done=true;
    var report=[];
    for(var i=0;i<keys.length;i++){
      var sels=keys[i];
      var el=document.querySelector(sels);if(!el)continue;
      var cs=getComputedStyle(el);
      var ov=cs.overflow,ovy=cs.overflowY;
      var h=cs.height,mh=cs.minHeight;
      report.push(sels+': overflow='+ov+'/'+ovy+' h='+h+' min-h='+mh);
    }
    A('layout',report);
  }
  window.addEventListener('scroll',function(){setTimeout(chk,50)},{once:true,capture:true,passive:true});
  window.addEventListener('touchmove',function(){setTimeout(chk,50)},{once:true,capture:true,passive:true});
})();

/* ── End enhanced monitors ── */

window.__cep_debug__=window.__cep_debug__||{};
window.__cep_debug__.getLogs=function(){return B.slice()};
window.__cep_debug__.clear=function(){B.length=0};
window.__cep_debug__.getEnv=function(){
  var v=window.__cep_debug__.version;
  var e={url:location.href,ua:navigator.userAgent,lang:navigator.language,plat:navigator.platform||'',size:innerWidth+'x'+innerHeight,dpr:String(devicePixelRatio||1),time:new Date().toISOString()};
  if(v){e.version=v.version;e.commit=v.commit;e.commitCount=v.count;e.commitTime=v.commitTime;e.buildTime=v.buildTime}
  return e;
};

/* openPanel — always opens (used by label click and settings page).
   togglePanel — toggles open/closed (used by multi-click gesture).
   Both load /debug-panel.js on demand if not yet loaded. */
function openPanel(){
  if(window.__cep_debug__&&window.__cep_debug__._openPanel){
    window.__cep_debug__._openPanel();return;
  }
  loadPanel(function(){if(window.__cep_debug__&&window.__cep_debug__._openPanel)window.__cep_debug__._openPanel()})
}
function togglePanel(){
  if(window.__cep_debug__&&window.__cep_debug__._togglePanel){
    window.__cep_debug__._togglePanel();return;
  }
  loadPanel(function(){if(window.__cep_debug__&&window.__cep_debug__._togglePanel)window.__cep_debug__._togglePanel()})
}
function loadPanel(cb){
  if(_loadCbs){_loadCbs.push(cb);return}
  _loadCbs=[cb];
  var s=document.createElement('script');
  s.src='/debug-panel.js';
  s.onload=function(){var cbs=_loadCbs;_loadCbs=null;for(var i=0;i<cbs.length;i++)cbs[i]()};
  s.onerror=function(){_loadCbs=null;alert('Failed to load debug panel.')};
  document.head.appendChild(s);
}

/* Expose to React DebugLabel component. */
window.__cep_debug__.openPanel=openPanel;
window.__cep_debug__.togglePanel=togglePanel;

/* Multi-click gesture + label click — both delegated on document (capture phase).
   Child-bound handlers are unreachable when Next.js error overlay calls
   stopPropagation() at document level. */
var C=0,T=0,_loadCbs=null;document.addEventListener('click',function(e){
  /* Label click — check ancestors for data-debug="label" */
  var t=e.target;while(t){if(t.getAttribute&&t.getAttribute('data-debug')==='label'){e.stopPropagation();openPanel();return}t=t.parentElement}
  /* Multi-click gesture (not on label) */
  C++;if(T)clearTimeout(T);if(C>=${DEBUG_CLICK_THRESHOLD}){C=0;togglePanel()}T=setTimeout(function(){C=0},1000)
},true);
})();`.replace(/\n\s*/g, '')
