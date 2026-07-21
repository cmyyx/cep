import { describe, expect, it } from 'vitest'
import { normalizeEssenceSettingsFlags } from './useEssenceSettingsStore'

describe('normalizeEssenceSettingsFlags', () => {
  it('defaults both three-star filters on and split ownership subsettings off', () => {
    const flags = normalizeEssenceSettingsFlags(undefined)

    expect(flags.hideThreeStarWeaponsList).toBe(true)
    expect(flags.hideThreeStarWeaponsPlans).toBe(true)
    expect(flags.onlyHideWhenBothOwnedList).toBe(false)
    expect(flags.onlyHideWhenBothOwnedPlans).toBe(false)
  })

  it('keeps list and plan settings independent and ignores the removed shared key', () => {
    const flags = normalizeEssenceSettingsFlags({
      hideThreeStarWeaponsList: false,
      hideThreeStarWeaponsPlans: true,
      onlyHideWhenBothOwnedList: true,
      onlyHideWhenBothOwnedPlans: false,
      onlyHideWhenBothOwned: true,
    })

    expect(flags.hideThreeStarWeaponsList).toBe(false)
    expect(flags.hideThreeStarWeaponsPlans).toBe(true)
    expect(flags.onlyHideWhenBothOwnedList).toBe(true)
    expect(flags.onlyHideWhenBothOwnedPlans).toBe(false)
    expect('onlyHideWhenBothOwned' in flags).toBe(false)
  })

  it('falls back from corrupted flag values without disturbing valid flags', () => {
    const flags = normalizeEssenceSettingsFlags({
      hideFourStarWeaponsList: false,
      hideThreeStarWeaponsList: 'false',
    })

    expect(flags.hideFourStarWeaponsList).toBe(false)
    expect(flags.hideThreeStarWeaponsList).toBe(true)
  })
})
