/**
 * Mobile debug bootstrap — inline script injected into <head> via HeadScript.
 *
 * ================================================================
 * AGENTS.md EXCEPTION NOTES:
 * ================================================================
 *
 * 1. **Inline styles (style attribute on DOM elements)**:
 *    CRASH-RECOVERY TOOL. When CSS is not loaded, the debug label MUST
 *    render using only inline styles. Debug chrome only.
 *
 * 2. **Bare DOM elements (createElement, appendChild)**:
 *    LAST-RESORT debugging surface. Must function when React/Shadcn
 *    are unavailable. All DOM is scoped to __cep_debug__ prefix.
 *
 * 3. **`dangerouslySetInnerHTML`** (via HeadScript in layout.tsx):
 *    Already covered by existing exception for head-script.tsx.
 * ================================================================
 */

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
   togglePanel — toggles open/closed (used by 5-click gesture).
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
  var lbl=document.getElementById('__cep_debug_label');
  if(lbl){lbl.textContent='Loading...';lbl.style.cursor='wait';lbl.style.opacity='0.7'}
  var s=document.createElement('script');
  s.src='/debug-panel.js';
  s.onload=function(){
    if(lbl){lbl.textContent='Debug Console';lbl.style.cursor='pointer';lbl.style.opacity='1'}
    cb()
  };
  s.onerror=function(){
    if(lbl){lbl.textContent='Debug Console';lbl.style.cursor='pointer';lbl.style.opacity='1'}
    alert('Failed to load debug panel.')
  };
  document.head.appendChild(s);
}

/* Floating [DEBUG] label — visible during page load, auto-hides after
   load completes. Pure DOM, no CSS/React dependency. Single-click opens. */
(function(){
  var label=document.createElement('button');
  label.id='__cep_debug_label';
  label.textContent='Debug Console';
  label.setAttribute('style','position:fixed;bottom:12px;right:12px;z-index:2147483647;'+
    'background:rgba(0,0,0,0.55);color:#fff;border:1px solid rgba(255,255,255,0.2);'+
    'font-size:13px;padding:4px 10px;border-radius:4px;font-weight:500;'+
    'letter-spacing:0.5px;cursor:pointer;'+
    'font-family:system-ui,-apple-system,sans-serif;'+
    '-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;outline:none;'+
    'transition:opacity 0.6s ease;opacity:1');
  /* Bind via document capture delegation — survives Next.js error overlay
     which calls stopPropagation() at document level. Child-bound handlers
     never receive the event. */
  label.setAttribute('data-debug','label');
  (function a(){if(document.body)document.body.appendChild(label);else requestAnimationFrame(a)})();

  /* Auto-hide after page finishes loading (window.onload + 3s grace) */
  function hide(){label.style.opacity='0';setTimeout(function(){if(label.parentNode)label.parentNode.removeChild(label)},700)}
  if(document.readyState==='complete'){setTimeout(hide,3000)}
  else{window.addEventListener('load',function(){setTimeout(hide,3000)})}
})();

/* 5-click gesture + label click — both delegated on document (capture phase).
   Child-bound handlers are unreachable when Next.js error overlay calls
   stopPropagation() at document level. */
var C=0,T=0;document.addEventListener('click',function(e){
  /* Label click — check ancestors for data-debug="label" */
  var t=e.target;while(t){if(t.getAttribute&&t.getAttribute('data-debug')==='label'){e.stopPropagation();openPanel();return}t=t.parentElement}
  /* 5-click gesture (not on label) */
  C++;if(T)clearTimeout(T);if(C>=5){C=0;togglePanel()}T=setTimeout(function(){C=0},1000)
},true);
})();`.replace(/\n\s*/g, '')
