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
const DEBUG_CLICK_THRESHOLD = 7

export const DEBUG_BOOTSTRAP_CODE = `(function(){
var B=[],M=1000;
function A(l,a){
  var s=[];for(var i=0;i<a.length;i++){var v=a[i];try{s.push(typeof v==='string'?v:JSON.stringify(v))}catch(e){s.push(String(v))}}
  B.push({l:l,t:Date.now(),a:s});if(B.length>M)B.shift();
}
(function(){var L=['debug','log','warn','error'];for(var i=0;i<L.length;i++){(function(lev){var o=console[lev].bind(console);console[lev]=function(){A(lev,Array.prototype.slice.call(arguments));o.apply(console,arguments)}})(L[i])}})();
window.addEventListener('error',function(e){if(e.target===window||(e.target&&e.message))A('error',[e.message||'Unknown',(e.filename||'')+':'+(e.lineno||'')]);});
window.addEventListener('error',function(e){var t=e.target;if(t&&(t instanceof HTMLLinkElement||t instanceof HTMLScriptElement||t instanceof HTMLImageElement))A('resource',[(t.tagName||'el').toLowerCase()+' failed: '+(t.href||t.src||'')])},true);
window.addEventListener('unhandledrejection',function(e){A('error',['[Rejection]',e.reason])});
window.__cep_debug__={getLogs:function(){return B.slice()},clear:function(){B.length=0},getEnv:function(){return{url:location.href,ua:navigator.userAgent,lang:navigator.language,plat:navigator.platform||'',size:innerWidth+'x'+innerHeight,dpr:String(devicePixelRatio||1),time:new Date().toISOString()}}};

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
window.__cep_debug__ = window.__cep_debug__ || {};
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
