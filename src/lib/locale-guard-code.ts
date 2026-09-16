/**
 * Blocking <head> locale redirect, shared by the build-time guard bundle.
 *
 * When the user has an explicit language preference (not "auto") and the URL
 * locale does not match it, this runs synchronously before any page content
 * renders and redirects — the earliest possible point in a pure SSG setup,
 * avoiding a flash of the wrong language.
 *
 * Lives here (not as a React `<head>` node) for the same reason as the other
 * head guards: React renders layout `<head>` children AFTER Next's stylesheet
 * links and chunk `<script>` tags, so a React-rendered guard only executes once
 * the CSS round-trip completes — measured at 1451 ms on Slow 4G, by which point
 * 28 requests had started and 31 chunk downloads were aborted by the redirect.
 * `scripts/prune-export.mjs` injects this code immediately after `<meta charset>`,
 * ahead of both.
 *
 * `LocaleGuard` (React, in `[locale]/layout.tsx`) covers `next dev`, where the
 * injected bundle is not produced.
 */
export const LOCALE_GUARD_HEAD_CODE = `(function(){
try{
var s=["zh-CN","zh-TW","ja","en"];
var n=window.location.pathname;
var g=n.split("/");
var u=g.length>1?g[1]:"";
var c=s.find(function(x){return x.toLowerCase()===u.toLowerCase()});
if(c)document.documentElement.lang=c;
var r=localStorage.getItem("cep-settings");
if(!r)return;
var p=JSON.parse(r);
var l=p.language;
if(!l||l==="auto")return;
if(s.indexOf(l)===-1)return;
if(g.length>1&&g[1]){
var m=s.some(function(x){return x.toLowerCase()===g[1].toLowerCase()});
if(m&&g[1].toLowerCase()===l.toLowerCase())return;
if(m){g[1]=l}else{g.splice(1,0,l)}
window.location.replace(window.location.origin+g.join("/")+window.location.search+window.location.hash)
}
}catch(e){}
})()`
