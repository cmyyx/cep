import type {
  WikiCharacterDetailMap,
  WikiCharacterSummary,
  WikiEquipmentDetailMap,
  WikiEquipmentSummary,
  WikiWeaponDetailMap,
  WikiWeaponSummary,
  WikiRichTextTerm,
} from '../../src/types/wiki'
import { PLANNER_RESOURCE_ICON_IDS } from '../../src/lib/planner-resource-ids'

export interface WikiAssets {
  characters: string[]
  characterFullBody: string[]
  characterPotential: string[]
  weapons: string[]
  equipment: string[]
  skills: string[]
  logisticsSkills: string[]
  materials: string[]
  /** Inline images embedded in glossary rich text (e.g. BuffIcon/*). */
  buffIcons: string[]
}

interface WikiAssetSource {
  characters: {
    summaries: WikiCharacterSummary[]
    details: WikiCharacterDetailMap
  }
  items: {
    weaponSummaries: WikiWeaponSummary[]
    weaponDetails: WikiWeaponDetailMap
    equipmentSummaries: WikiEquipmentSummary[]
    equipmentDetails: WikiEquipmentDetailMap
  }
  /** Glossary terms whose rich text may embed inline images (e.g. BuffIcon/*). */
  richText?: Record<string, WikiRichTextTerm>
}

export function collectWikiAssets(source: WikiAssetSource): WikiAssets {
  const characters = new Set(source.characters.summaries.map((entry) => entry.imageId))
  const characterFullBody = new Set<string>()
  const characterPotential = new Set<string>()
  const weapons = new Set(source.items.weaponSummaries.map((entry) => entry.imageId))
  const equipment = new Set(source.items.equipmentSummaries.map((entry) => entry.imageId))
  const skills = new Set<string>()
  const logisticsSkills = new Set<string>()
  const materials = new Set<string>()
  for (const iconId of PLANNER_RESOURCE_ICON_IDS) {
    materials.add(iconId)
  }

  for (const detail of Object.values(source.characters.details)) {
    for (const imageId of Object.values(detail.images.fullBodyIds)) {
      if (imageId) characterFullBody.add(imageId)
    }
    for (const potential of detail.potentials) {
      for (const imageId of potential.imageIds) characterPotential.add(imageId)
    }
    for (const skill of detail.skills) {
      if (skill.iconId) skills.add(skill.iconId)
      for (const variant of skill.variants ?? []) {
        if (variant.iconId) skills.add(variant.iconId)
      }
      for (const level of skill.levels) {
        for (const material of level.materials ?? []) materials.add(material.iconId)
      }
    }
    for (const talent of detail.talents) {
      if (talent.iconId) skills.add(talent.iconId)
      for (const material of talent.materials) materials.add(material.iconId)
    }
    for (const node of detail.attributeNodes) {
      for (const material of node.materials) materials.add(material.iconId)
    }
    for (const node of detail.logisticsNodes) {
      for (const material of node.materials) materials.add(material.iconId)
    }
    for (const skill of detail.logisticsSkills) {
      if (skill.iconId) logisticsSkills.add(skill.iconId)
    }
    for (const promotion of detail.promotions) {
      for (const material of promotion.materials) materials.add(material.iconId)
    }
  }
  for (const detail of Object.values(source.items.weaponDetails)) {
    for (const breakthrough of detail.breakthroughs) {
      for (const material of breakthrough.materials) materials.add(material.iconId)
    }
  }
  for (const detail of Object.values(source.items.equipmentDetails)) {
    for (const recipe of detail.craftingRecipes) {
      for (const material of recipe.materials) materials.add(material.iconId)
    }
  }

  // Rich-text inline images (e.g. <image="BuffIcon/icon_energy_fusion_fire" scale=1.25>)
  // embedded in glossary descriptions. Only the BuffIcon/ directory exists in the
  // game text today; the CDN path is sprites/bufficon/{basename}.png.
  // 遍历所有 locale 的 name/description, 防止图标仅出现在非 zh-CN 翻译中时漏收;
  // 只接受单段基本名 (无 /), 与渲染端/转换端的单文件资源约定保持一致。
  const buffIcons = new Set<string>()
  for (const term of Object.values(source.richText ?? {})) {
    for (const text of [...Object.values(term.name), ...Object.values(term.description)]) {
      for (const match of text.matchAll(/<image="BuffIcon\/([A-Za-z0-9_.-]+)"\s+scale=[0-9.]+>/g)) {
        buffIcons.add(match[1])
      }
    }
  }

  const sorted = (values: Set<string>) => [...values].sort()
  return {
    characters: sorted(characters),
    characterFullBody: sorted(characterFullBody),
    characterPotential: sorted(characterPotential),
    weapons: sorted(weapons),
    equipment: sorted(equipment),
    skills: sorted(skills),
    logisticsSkills: sorted(logisticsSkills),
    materials: sorted(materials),
    buffIcons: sorted(buffIcons),
  }
}
