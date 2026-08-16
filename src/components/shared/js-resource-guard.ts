import {
  buildGuardFeedbackHtml,
  GUARD_ENVIRONMENT_HTML_CODE,
  GUARD_OVERLAY_CLOSE,
  GUARD_OVERLAY_OPEN,
} from '@/components/shared/guard-layout'

/**
 * Inline JS resource load failure guard — injected into <head>.
 *
 * The static export references every route chunk as `<script async
 * src="/_next/static/chunks/*.js">`. When one of those fails (deploy-stale
 * hash → 404, transient CDN blip), the browser fires an element-level error
 * event with `event.error === undefined` — invisible to ChunkLoadErrorGuard
 * (which only sees window errors with an Error object / unhandledrejection).
 * Hydration then never happens and the SSG-rendered AppInitOverlay stays on
 * screen forever with no message.
 *
 * Behaviour:
 *   1. Capture-phase listener records failing script/link URLs under
 *      /_next/static/ or /guards.js.
 *   2. After window.load (+ a 15s hang fallback) audit: if failures exist and
 *      the app never hydrated (no `data-cep-hydrated` sentinel on <html>),
 *      AUTO-RETRY the failed resources once (cache-busted re-insertion, no
 *      page reload). Only if they still fail does the full-screen fallback
 *      appear — a transient CDN blip self-heals without any user-visible
 *      disruption.
 *   3. Fallback page (zero external deps): failing URLs + "重试加载"
 *      (re-inserts the failed scripts with a cache-buster) + "刷新页面".
 *      Buttons are bound via addEventListener (inline `onclick` attributes
 *      can be blocked by CSP script-src-attr).
 *   4. The error page is localized from the URL's first path segment
 *      ([locale]/...); outside a locale route (e.g. /404.html) no overlay is
 *      shown — the 404 page owns that surface.
 *   5. Non-critical failures (hydration succeeded) are only console.warn'ed.
 */

/** Same key as ChunkLoadErrorGuard — one reload budget per page session. */
const RELOAD_ONCE_KEY = 'cep-chunk-reload-once'

/** The four locale route prefixes (must match src/i18n/routing). */
type GuardLocale = 'zh-CN' | 'zh-TW' | 'ja' | 'en'
/**
 * Localized copy for the fallback overlay. Text is resolved from the URL's
 * first path segment; unknown segments fall back to English.
 */
/**
 * Per-locale feedback block (compiled once; the guard picks by locale at
 * runtime, so each language sees only its own copy).
 */
const GUARD_FEEDBACK: Record<GuardLocale, string> = {
  'zh-CN': buildGuardFeedbackHtml('zh-CN'),
  'zh-TW': buildGuardFeedbackHtml('zh-TW'),
  ja: buildGuardFeedbackHtml('ja'),
  en: buildGuardFeedbackHtml('en'),
}

const GUARD_COPY: Record<GuardLocale, { title: string; description: string; resources: string; retry: string; reload: string }> = {
  'zh-CN': {
    title: '\u8D44\u6E90\u52A0\u8F7D\u5931\u8D25',
    description: '\u9875\u9762\u6240\u9700\u7684\u811A\u672C\u8D44\u6E90\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u52A0\u8F7D\u6216\u5237\u65B0\u9875\u9762\u3002',
    resources: '\u5931\u8D25\u7684\u8D44\u6E90',
    retry: '\u91CD\u8BD5\u52A0\u8F7D',
    reload: '\u5237\u65B0\u9875\u9762',
  },
  'zh-TW': {
    title: '\u8CC7\u6E90\u52A0\u8F09\u5931\u6557',
    description: '\u9801\u9762\u6240\u9700\u7684\u811A\u672C\u8CC7\u6E90\u52A0\u8F09\u5931\u6557\uFF0C\u8ACB\u91CD\u8A66\u52A0\u8F09\u6216\u5237\u65B0\u9801\u9762\u3002',
    resources: '\u5931\u6557\u7684\u8CC7\u6E90',
    retry: '\u91CD\u8A66\u52A0\u8F09',
    reload: '\u5237\u65B0\u9801\u9762',
  },
  ja: {
    title: '\u8CC7\u6E90\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F',
    description: '\u30DA\u30FC\u30B8\u306B\u5FC5\u8981\u306A\u30B9\u30AF\u30EA\u30D7\u30C8\u8CC7\u6E90\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u307E\u305F\u306F\u30EA\u30ED\u30FC\u30C9\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    resources: '\u5931\u6557\u3057\u305F\u8CC7\u6E90',
    retry: '\u518D\u8AAD\u307F\u8FBC\u307F',
    reload: '\u30DA\u30FC\u30B8\u3092\u66F4\u65B0',
  },
  en: {
    title: 'Resources failed to load',
    description: 'Script resources required by this page failed to load. Please retry or refresh the page.',
    resources: 'Failed resources',
    retry: 'Retry',
    reload: 'Refresh page',
  },
}

/**
 * Whether a resource URL is critical for initial hydration.
 * Exported for tests.
 */
export function isCriticalResourceUrl(url: string): boolean {
  return url.includes('/_next/static/') || url.includes('/guards.js')
}

/**
 * Resolve the guard locale from the URL's first path segment. Exported for
 * tests. NOTE: this body is embedded into the inline guard via toString(), so
 * it must be SELF-CONTAINED — no references to module-level constants.
 * 整个函数体必须是单一 return 表达式:嵌入后整段守卫代码会经正则去除
 * 换行与缩进折叠成一行,多语句源码在无显式分号时会粘连成语法错误。
 */
export function resolveGuardLocale(pathname: string): GuardLocale | null {
  return ((pathname ?? '').split('/')[1] ?? '').toLowerCase() === 'zh-cn'
    ? 'zh-CN'
    : ((pathname ?? '').split('/')[1] ?? '').toLowerCase() === 'zh-tw'
      ? 'zh-TW'
      : ((pathname ?? '').split('/')[1] ?? '').toLowerCase() === 'ja'
        ? 'ja'
        : ((pathname ?? '').split('/')[1] ?? '').toLowerCase() === 'en'
          ? 'en'
          : null
}

export const JS_RESOURCE_GUARD_CODE = `(function(){
var F=[],_loadDone=false,_audited=false;
var RETRY_KEY='cep-js-retried';
var RELOAD_KEY='${RELOAD_ONCE_KEY}';
var isCritical=${isCriticalResourceUrl.toString()};
var resolveLocale=${resolveGuardLocale.toString()};
var COPY=${JSON.stringify(GUARD_COPY)};
var FEEDBACK=${JSON.stringify(GUARD_FEEDBACK)};

var onErr=function(e){
  var t=e.target;
  if(!t||!t.tagName)return;
  var url=(t.src||t.href||'');
  /* Retry requests carry a _r= cache-buster; their outcome is tracked by
     retry()'s own onload/onerror handlers. Recording them here too would
     duplicate the resource in the failure list (raw URL + retry URL). */
  if(url.indexOf('_r=')>=0)return;
  if(!isCritical(url))return;
  if(F.indexOf(url)>=0)return;
  F.push(url);
};
document.addEventListener('error',onErr,true);

window.addEventListener('load',function(){_loadDone=true;tryAudit();});
setTimeout(function(){if(!_loadDone){_loadDone=true;tryAudit();}},15000);

function hydrated(){var h=document.documentElement;return !!h&&h.getAttribute('data-cep-hydrated')==='1';}

function tryAudit(){
  if(_audited||!_loadDone)return;
  _audited=true;
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    if(F.length===0)return;
    var locale=resolveLocale(window.location.pathname||'');
    if(!locale){
      try{console.warn('[JS Guard] chunk failures outside locale routes',F);}catch(e){}
      return;
    }
    if(hydrated()){
      try{console.warn('[JS Guard] non-critical chunk failures',F);}catch(e){}
      return;
    }
    /* Auto-retry the failed resources once (cache-busted re-insertion, no
       page reload). Only if they still fail do we surface the error page. */
    var retried=false;
    try{retried=sessionStorage.getItem(RETRY_KEY)==='1';}catch(e){}
    if(!retried){
      try{sessionStorage.setItem(RETRY_KEY,'1');}catch(e){}
      autoRetry(locale);
      return;
    }
    show(locale);
  })});
}

function autoRetry(locale){
  retry();
  /* Let the re-inserted scripts settle: loaded ones leave F, failed ones
     stay. If the page hydrated, we are done. Otherwise surface the error
     page once the retry outcome is known. */
  setTimeout(function(){
    /* 重试成功后页面完成 hydration:清除 RETRY_KEY,让同会话后续页面
       加载仍能获得一次自动重试预算。 */
    if(hydrated()){
      try{sessionStorage.removeItem(RETRY_KEY);}catch(e){}
      return;
    }
    if(F.length>0){show(locale);return;}
    setTimeout(function(){
      if(!hydrated()&&F.length>0)show(locale);
    },2000);
  },3000);
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function show(locale){
  if(document.getElementById('cep-js-fatal'))return;
  var c=COPY[locale]||COPY.en;
  var list='';
  var shown=F.slice(0,5);
  for(var i=0;i<shown.length;i++){
    list+='<p style="font-size:12px;color:#888;word-break:break-all;margin:2px 0;">'+esc(shown[i])+'</p>';
  }
  if(F.length>5)list+='<p style="font-size:12px;color:#888;margin:2px 0;">... +'+(F.length-5)+'</p>';
  var html=${JSON.stringify(GUARD_OVERLAY_OPEN)}
    + '<h2 style="font-size:16px;font-weight:500;margin:0;color:#171717;">'+esc(c.title)+'</h2>'
    + '<p style="color:#666;max-width:420px;line-height:1.6;margin:8px 0 0;">'+esc(c.description)+'</p>'
    + '<div style="margin-top:10px;text-align:left;padding:8px 10px;border-radius:6px;background:#fafafa;border:1px solid #eee;max-height:140px;overflow-y:auto;min-width:min(420px,80vw);">'
    + '<p style="font-size:12px;color:#999;margin:0 0 4px;">'+esc(c.resources)+'</p>'
    + list
    + '</div>'
    + '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">'
    + '<button id="cep-js-fatal-retry" style="padding:8px 20px;border:none;border-radius:6px;background:#171717;color:#fff;font-size:14px;cursor:pointer;font-family:system-ui,sans-serif;">'+esc(c.retry)+'</button>'
    + '<button id="cep-js-fatal-reload" style="padding:8px 20px;border:none;border-radius:6px;background:#f0f0f0;color:#171717;font-size:14px;cursor:pointer;font-family:system-ui,sans-serif;">'+esc(c.reload)+'</button>'
    + '</div>'
    /* Environment info block: an executable snippet that RETURNS HTML (same
       pattern as css-guard) — must be concatenated as code, never stringified. */
    + ${GUARD_ENVIRONMENT_HTML_CODE}
    + (FEEDBACK[locale]||FEEDBACK.en)
    + ${JSON.stringify(GUARD_OVERLAY_CLOSE)};
  var d=document.createElement('div');
  d.id='cep-js-fatal';
  d.innerHTML=html;
  (document.body||document.documentElement).appendChild(d);

  /* Bind handlers programmatically: inline onclick attributes can be blocked
     by CSP (script-src-attr) even when inline <script> is allowed. */
  var retryBtn=d.querySelector('#cep-js-fatal-retry');
  if(retryBtn)retryBtn.addEventListener('click',function(){retry();});
  var reloadBtn=d.querySelector('#cep-js-fatal-reload');
  if(reloadBtn)reloadBtn.addEventListener('click',function(){
    /* A manual refresh starts a clean session: drop both the retry flag and
       ChunkLoadErrorGuard's reload budget so nothing blocks a fresh page. */
    try{sessionStorage.removeItem(RETRY_KEY);}catch(e){}
    try{sessionStorage.removeItem(RELOAD_KEY);}catch(e){}
    window.location.reload();
  });
}

function retry(){
  var urls=F.slice();
  for(var i=0;i<urls.length;i++){
    (function(u){
      /* CSS 资源用 <link rel="stylesheet"> 重试,JS 资源继续用 <script>。
         link 元素没有 async/src,使用 href;onload/onerror 对两者都生效。 */
      var isCss=u.split('?')[0].slice(-4)==='.css';
      var el;
      if(isCss){
        el=document.createElement('link');
        el.rel='stylesheet';
        el.href=u+(u.indexOf('?')>=0?'&':'?')+'_r='+Date.now();
      }else{
        el=document.createElement('script');
        el.async=true;
        el.src=u+(u.indexOf('?')>=0?'&':'?')+'_r='+Date.now();
      }
      /* Loaded resources leave F (they are no longer failing); failed ones
         (re-)enter F so the auto-retry outcome is accurate. */
      el.onload=function(){
        var idx=F.indexOf(u);
        if(idx>=0)F.splice(idx,1);
      };
      el.onerror=function(){
        if(F.indexOf(u)<0)F.push(u);
      };
      document.head.appendChild(el);
    })(urls[i]);
  }
}

var pollTimer=setInterval(function(){
  var el=document.getElementById('cep-js-fatal');
  /* hydration 完成后:移除覆盖层(若存在)并终止轮询,守卫正常收尾。 */
  if(!hydrated())return;
  if(el&&el.parentNode)el.parentNode.removeChild(el);
  clearInterval(pollTimer);
},1000);
/* 返回清理函数(仅测试使用;生产环境返回值被丢弃):移除 error 监听并
   停止轮询,避免跨测试泄漏监听器与定时器。 */
return function(){
  try{document.removeEventListener('error',onErr,true);}catch(e){}
  try{clearInterval(pollTimer);}catch(e){}
};
})()`.replace(/\n\s*/g, '')
