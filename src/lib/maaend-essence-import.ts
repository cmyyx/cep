import { z } from 'zod'
import { weapons } from '@/data/weapons'

const knownWeaponIds = new Set(weapons.map((weapon) => weapon.id))

const inventorySchema = z.array(z.strictObject({
  weapon_ids: z.array(z.string().regex(/^wpn_[a-z0-9_]+$/))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length),
  essences: z.array(z.strictObject({
    levels: z.tuple([
      z.number().int().min(1).max(6),
      z.number().int().min(1).max(6),
      z.number().int().min(1).max(3),
    ]),
    count: z.number().int().positive(),
  })).min(1),
}))

export type MaaEndEssenceImportError = 'invalidJson' | 'invalidFormat' | 'unknownOnly'

export type MaaEndEssenceImportResult =
  | { ok: true; weaponIds: string[]; unknownWeaponIds: string[] }
  | { ok: false; error: MaaEndEssenceImportError; unknownWeaponIds: string[] }

/** Decode the official inventory format; levels and counts never limit marks. */
export function parseMaaEndEssenceInventory(text: string): MaaEndEssenceImportResult {
  let input: unknown
  try {
    input = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return { ok: false, error: 'invalidJson', unknownWeaponIds: [] }
  }
  const parsed = inventorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'invalidFormat', unknownWeaponIds: [] }
  }
  const ids = [...new Set(parsed.data.flatMap((group) => group.weapon_ids))]
  const weaponIds = ids.filter((id) => knownWeaponIds.has(id))
  const unknownWeaponIds = ids.filter((id) => !knownWeaponIds.has(id))
  if (parsed.data.length > 0 && weaponIds.length === 0) {
    return { ok: false, error: 'unknownOnly', unknownWeaponIds }
  }
  return {
    ok: true,
    weaponIds,
    unknownWeaponIds,
  }
}
