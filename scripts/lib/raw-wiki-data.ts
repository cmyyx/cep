import type {
  WikiCharacterDetail,
  WikiCharacterSummary,
  WikiEquipmentDetail,
  WikiEquipmentSummary,
  WikiRichTextTerm,
  WikiWeaponDetail,
  WikiWeaponSummary,
} from '../../src/types/wiki'

import { equipmentModelKeyFromZhCN } from '../../src/lib/wiki-summary-locale'
type Material = { itemId: string; count: number; iconId?: string; rarity?: number }

function rawMaterial(material: Material): Record<string, unknown> {
  return {
    itemId: material.itemId,
    count: material.count,
    ...(material.iconId ? { iconId: material.iconId } : {}),
    ...(material.rarity === undefined ? {} : { rarity: material.rarity }),
  }
}


export function rawWeaponSummary(summary: WikiWeaponSummary): Omit<WikiWeaponSummary, 'name'> {
  const raw = { ...summary } as Omit<WikiWeaponSummary, 'name'> & { name?: WikiWeaponSummary['name'] }
  delete raw.name
  return raw
}
export function rawEquipmentSummary(summary: WikiEquipmentSummary): Omit<WikiEquipmentSummary, 'name' | 'suitName'> {
  const raw = { ...summary } as Omit<WikiEquipmentSummary, 'name' | 'suitName'> & { name?: WikiEquipmentSummary['name']; suitName?: WikiEquipmentSummary['suitName'] }
  const modelKey = summary.modelKey ?? (summary.name ? equipmentModelKeyFromZhCN(summary.name['zh-CN']) : undefined)
  delete raw.name
  delete raw.suitName
  if (modelKey) raw.modelKey = modelKey
  return raw
}

export function rawCharacterSummary(summary: WikiCharacterSummary): Omit<WikiCharacterSummary, 'name'> {
  const raw = { ...summary } as Omit<WikiCharacterSummary, 'name'> & { name?: WikiCharacterSummary['name'] }
  delete raw.name
  return raw
}

export function rawWeaponDetail(detail: WikiWeaponDetail): Record<string, unknown> {
  return {
    id: detail.id,
    category: detail.category,
    maxLevel: detail.maxLevel,
    levels: detail.levels,
    skills: detail.skills.map((skill) => ({
      id: skill.id,
      levels: skill.levels.map((level) => ({ level: level.level })),
    })),
    breakthroughs: detail.breakthroughs.map((breakthrough) => ({
      stage: breakthrough.stage,
      requiredLevel: breakthrough.requiredLevel,
      stats: breakthrough.stats,
      materials: breakthrough.materials.map(rawMaterial),
    })),
  }
}

export function rawEquipmentDetail(detail: WikiEquipmentDetail): Record<string, unknown> {
  return {
    id: detail.id,
    category: detail.category,
    stats: detail.stats.map(({ attributeId, values }) => ({ attributeId, values })),
    suitEffects: detail.suitEffects.map((effect) => ({
      id: effect.id,
      requiredPieces: effect.requiredPieces,
      values: effect.values,
    })),
    craftingRecipes: detail.craftingRecipes.map((recipe) => ({
      chainId: recipe.chainId,
      discount: recipe.discount,
      isDefault: recipe.isDefault,
      materials: recipe.materials.map(rawMaterial),
    })),
  }
}

export function rawCharacterDetail(detail: WikiCharacterDetail): Record<string, unknown> {
  return {
    id: detail.id,
    category: detail.category,
    maxLevel: detail.maxLevel,
    levels: detail.levels,
    fixedStats: detail.fixedStats,
    skills: detail.skills.map((skill) => ({
      id: skill.id,
      typeId: skill.typeId,
      iconId: skill.iconId,
      metrics: skill.metrics.map((metric) => ({ id: metric.id })),
      levels: skill.levels.map((level) => ({
        level: level.level,
        label: level.label,
        values: level.values,
        coolDown: level.coolDown,
        costValue: level.costValue,
        materials: level.materials?.map(rawMaterial),
      })),
      variants: skill.variants?.map((variant) => ({
        id: variant.id,
        iconId: variant.iconId,
        metrics: variant.metrics.map((metric) => ({ id: metric.id })),
        levels: variant.levels.map((level) => ({
          level: level.level,
          label: level.label,
          values: level.values,
          coolDown: level.coolDown,
          costValue: level.costValue,
          materials: level.materials?.map(rawMaterial),
        })),
      })),
    })),
    talents: detail.talents.map((talent) => ({
      id: talent.id,
      breakStage: talent.breakStage,
      materials: talent.materials.map(rawMaterial),
    })),
    attributeNodes: detail.attributeNodes.map((node) => ({
      id: node.id,
      iconId: node.iconId,
      breakStage: node.breakStage,
      favorability: node.favorability,
      stats: node.stats,
      materials: node.materials.map(rawMaterial),
    })),
    equipmentNodes: detail.equipmentNodes.map((node) => ({
      id: node.id,
      breakStage: node.breakStage,
      equipmentTierLimit: node.equipmentTierLimit,
      materials: node.materials.map(rawMaterial),
    })),
    logisticsNodes: detail.logisticsNodes.map((node) => ({ ...node, materials: node.materials.map(rawMaterial) })),
    potentials: detail.potentials.map((potential) => ({
      id: potential.id,
      level: potential.level,
      imageIds: potential.imageIds,
    })),
    logisticsSkills: detail.logisticsSkills.map((skill) => ({
      id: skill.id,
      iconId: skill.iconId,
      index: skill.index,
      level: skill.level,
    })),
    promotions: detail.promotions.map((promotion) => ({ ...promotion, materials: promotion.materials.map(rawMaterial) })),
    images: detail.images,
    cvNames: detail.cvNames.map(({ language, original }) => ({ language, original })),
  }
}

export function rawGlossary(glossary: Record<string, WikiRichTextTerm>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(glossary).map(([id, term]) => [id, { styleId: term.styleId }]))
}

export function rawEnumLabels(labels: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(labels).map(([group, values]) => [
    group,
    Object.fromEntries(Object.keys(values).map((id) => [id, {}])),
  ]))
}
