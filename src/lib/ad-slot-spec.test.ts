import { describe, expect, it } from 'vitest'
import {
  AD_SLOT_BOX_CLASS,
  AD_SLOT_COMPACT_DESKTOP_BOX,
  AD_SLOT_RESERVED_BOX,
  ADS_ENABLED,
} from './ad-slot-spec'

describe('ad-slot-spec', () => {
  it('广告位默认关闭（NEXT_PUBLIC_ADS_ENABLED 未设为 true）', () => {
    expect(ADS_ENABLED).toBe(false)
  })

  it('盒位尺寸与历史约定一致：桌面 300x250，移动 320x120', () => {
    expect(AD_SLOT_RESERVED_BOX.desktop).toEqual({ width: 300, height: 250 })
    expect(AD_SLOT_RESERVED_BOX.mobile).toEqual({ width: 320, height: 120 })
    expect(AD_SLOT_COMPACT_DESKTOP_BOX).toEqual({ width: 320, height: 120 })
  })

  it('类名是字面量且与盒位数字一致（Tailwind 只能扫到字面量）', () => {
    // 桌面：窄屏先落紧凑盒位，>1024px 再放大到 300x250
    expect(AD_SLOT_BOX_CLASS.desktop).toContain(
      `h-[${AD_SLOT_COMPACT_DESKTOP_BOX.height}px]`,
    )
    expect(AD_SLOT_BOX_CLASS.desktop).toContain(
      `min-[1025px]:h-[${AD_SLOT_RESERVED_BOX.desktop.height}px]`,
    )
    expect(AD_SLOT_BOX_CLASS.desktop).toContain(
      `min-[1025px]:w-[${AD_SLOT_RESERVED_BOX.desktop.width}px]`,
    )
    // 移动端：固定 320x120
    expect(AD_SLOT_BOX_CLASS.mobile).toContain(`h-[${AD_SLOT_RESERVED_BOX.mobile.height}px]`)
    expect(AD_SLOT_BOX_CLASS.mobile).toContain(`w-[${AD_SLOT_RESERVED_BOX.mobile.width}px]`)
  })
})
