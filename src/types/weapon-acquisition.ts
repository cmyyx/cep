/**
 * A normalized in-game acquisition category. The string stays open-ended so
 * new upstream categories can be preserved without a frontend type change.
 */
export type WeaponAcquisitionCategoryId = string

/**
 * A source reference attached to a weapon. The same source can be referenced
 * by many weapons; sourceId is scoped by categoryId.
 */
export interface WeaponAcquisitionSource {
  categoryId: WeaponAcquisitionCategoryId
  sourceId: string
}

export type WeaponAcquisitionSourceMap = Record<string, WeaponAcquisitionSource[]>
