import { HeadScript } from '@/components/shared/head-script'

/**
 * Locale redirect via blocking <head> script.
 *
 * When the user has an explicit language preference (not "auto"),
 * this runs synchronously before any page content renders and
 * redirects to the matching locale if the current URL doesn't match.
 *
 * This is the earliest possible redirect point in a pure SSG setup —
 * faster than LocaleGuard's useEffect, avoiding the flash of wrong
 * language content.
 */
export function LocaleGuardHead() {
  return <HeadScript id="locale-guard-head" code={LOCALE_GUARD_HEAD_CODE} />
}

const LOCALE_GUARD_HEAD_CODE = `(function(){
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
