/**
 * 广告位的尺寸规格与总开关 —— 与具体广告平台无关。
 *
 * 站点当前不投放任何广告（`ADS_ENABLED = false`），槽位组件照常存在但整块不渲染、
 * 不发起任何广告请求。接入下一个平台时只需要：
 *
 * 1. 让 `use-ad-polling` 的取数换成新平台的来源（或继续用运营服务的 creatives.json）；
 * 2. 把 `NEXT_PUBLIC_ADS_ENABLED` 设为 `true`；
 * 3. 按下面的盒位尺寸准备素材。
 *
 * 盒位是历史约定、不要随手改：桌面侧栏在 >1024px 用 300x250（窄屏落到 320x120），
 * 移动端顶部 banner 用 320x120。改尺寸会让侧栏与页面内容的布局在广告出现时跳动。
 *
 * Tailwind 只能从源码里扫到**字面量**类名，所以这里的类名必须是完整字符串，
 * 不能由数字拼出来。
 */

/** 广告位开关。默认关闭：未显式开启时连轮询都不会启动。 */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true'

/** 一个广告槽位的预留盒位（宽 x 高，单位 px）。 */
export interface AdSlotBox {
  width: number
  height: number
}

/** 各槽位的预留盒位。 */
export const AD_SLOT_RESERVED_BOX: Record<'desktop' | 'mobile', AdSlotBox> = {
  desktop: { width: 300, height: 250 },
  mobile: { width: 320, height: 120 },
}

/** 桌面侧栏在 ≤1024px 时收窄到的盒位。 */
export const AD_SLOT_COMPACT_DESKTOP_BOX: AdSlotBox = { width: 320, height: 120 }

/**
 * 与 AD_SLOT_RESERVED_BOX 一一对应的 Tailwind 尺寸类（字面量，供扫描）。
 * 桌面端窄屏（≤1024px）落到紧凑盒位，所以在同一串里写断点覆盖。
 */
export const AD_SLOT_BOX_CLASS: Record<'desktop' | 'mobile', string> = {
  desktop: 'h-[120px] w-[300px] min-[1025px]:h-[250px] min-[1025px]:w-[300px]',
  mobile: 'h-[120px] w-[320px]',
}
