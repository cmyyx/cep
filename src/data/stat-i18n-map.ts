/**
 * Stat name i18n mapping: CN attribute name -> GemTable gemTermId.
 * Used by both Essence Planner (weapon stats) and Refinement Planner (equip stats)
 * to translate hardcoded Chinese attribute names via t('stats.' + gemTermId).
 *
 * Generated from GemTable.json tagName.id -> TextTable_CN lookup.
 * Add new mappings as new stats appear in game data.
 */

/** Map CN stat name (exact match) -> GemTable gemTermId */
export const STAT_TO_GEM_TERM: Record<string, string> = {
  // Primary stats (weapon primaryStat / equip main stat)
  '力量提升': 'gat_passive_attr_str',
  '敏捷提升': 'gat_passive_attr_agi',
  '智识提升': 'gat_passive_attr_wisd',
  '意志提升': 'gat_passive_attr_will',
  '主能力提升': 'gat_passive_attr_main',

  // Short forms used in equip data
  '力量': 'gat_passive_attr_str',
  '敏捷': 'gat_passive_attr_agi',
  '智识': 'gat_passive_attr_wisd',
  '意志': 'gat_passive_attr_will',
  '主能力': 'gat_passive_attr_main',

  // Secondary stats / elemental damage (weapon elementalDamage / equip sub)
  '攻击提升': 'gat_passive_attr_atk',
  '物理伤害提升': 'gat_passive_attr_phydam',
  '灼热伤害提升': 'gat_passive_attr_firedam',
  '电磁伤害提升': 'gat_passive_attr_pulsedam',
  '寒冷伤害提升': 'gat_passive_attr_icedam',
  '自然伤害提升': 'gat_passive_attr_naturaldam',
  '法术伤害提升': 'gat_passive_attr_magicdam',
  '源石技艺提升': 'gat_passive_attr_physpell',
  '暴击率提升': 'gat_passive_attr_crirate',
  '终结技充能效率提升': 'gat_passive_attr_usp',
  '治疗效率提升': 'gat_passive_attr_heal',
  '生命提升': 'gat_passive_attr_hp',

  // Short forms (equip data)
  '攻击': 'gat_passive_attr_atk',
  '物理伤害加成': 'gat_passive_attr_phydam',
  '暴击率': 'gat_passive_attr_crirate',
  '生命值': 'gat_passive_attr_hp',
  '终结技充能效率': 'gat_passive_attr_usp',
  '治疗效率加成': 'gat_passive_attr_heal',
  '源石技艺强度': 'gat_passive_attr_physpell',

  // Special abilities (weapon specialAbility / equip special)
  '强攻': 'gst_passive_force',
  '压制': 'gst_passive_tactic',
  '追袭': 'gst_passive_combo',
  '粉碎': 'gst_passive_smash',
  '巧技': 'gst_passive_phyabn',
  '迸发': 'gst_passive_burst',
  '流转': 'gst_passive_tacafter',
  '效益': 'gst_passive_keyword',
  '昂扬': 'gst_passive_spirit',
  '残暴': 'gst_passive_break',
  '附术': 'gst_passive_magabn',
  '医疗': 'gst_passive_heal',
  '切骨': 'gst_passive_crit',
  '夜幕': 'gst_passive_ult',
}

/**
 * Some equip stats have compound names like "灼热和自然伤害" that don't map
 * directly to a single GemTable term. These are looked up by exact CN name
 * in the TextTable (not through gem terms).
 */
export const COMPOUND_STAT_CN_NAMES: string[] = [
  '寒冷和电磁伤害加成',
  '灼热和自然伤害加成',
  '对失衡目标伤害加成',
  '普通攻击伤害加成',
  '战技伤害加成',
  '终结技伤害加成',
  '连携技伤害加成',
  '所有技能伤害加成',
  '全伤害减免',
  '副能力',
]

/**
 * Resolve a CN stat name to its display-ready i18n key path.
 * Returns the key for t() lookup, or null if unknown.
 */
export function resolveStatI18nKey(cnStatName: string): string | null {
  // Try exact GemTable mapping first
  const gemTermId = STAT_TO_GEM_TERM[cnStatName]
  if (gemTermId) return `stats.${gemTermId}`

  // Try compound stat names (these go through TextTable directly)
  if (COMPOUND_STAT_CN_NAMES.includes(cnStatName)) {
    return `stats.${cnStatName}`
  }

  return null
}
