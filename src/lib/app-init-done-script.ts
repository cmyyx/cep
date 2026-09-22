import { APP_INIT_STORAGE_KEY } from '@/lib/constants'

/**
 * Inline `<head>` script that marks a repeat visit before the body is parsed.
 *
 * `useAppInitStore` persists `hasCompleted` to sessionStorage, so `AppInitOverlay`
 * renders nothing on a reload in the same tab. But the overlay is also part of
 * the static SSG HTML — without this script the curtain would still be painted
 * on the first frame and only removed once React hydrates, which is worse than
 * not having a curtain at all. Setting `<html data-cep-init-done>` lets CSS
 * (see globals.css) suppress it from the very first paint.
 *
 * Reads zustand/persist's envelope shape: `{ state: { hasCompleted }, version }`.
 * The storage key comes from `@/lib/constants` so this script and the store
 * cannot drift — the layout cannot import the store, and this module cannot
 * import zustand, so the key is the shared contract.
 *
 * Any failure (storage blocked, corrupt JSON) leaves the attribute unset, which
 * degrades to showing the curtain — the safe direction.
 */
export const APP_INIT_DONE_SCRIPT =
  `(function(){try{` +
  `var r=sessionStorage.getItem(${JSON.stringify(APP_INIT_STORAGE_KEY)});` +
  `if(!r)return;` +
  `var p=JSON.parse(r);` +
  `if(p&&p.state&&p.state.hasCompleted===true){` +
  `document.documentElement.setAttribute('data-cep-init-done','1')` +
  `}` +
  `}catch(e){}})()`
