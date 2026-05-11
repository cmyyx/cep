import type { Equip, ParsedStat } from '@/types/refinement'

// ─── Old project data (equip.js) ──────────────────────────────────────────

interface RawEquip {
  name: string
  set: string
  rarity: 5
  type: '配件' | '护手' | '护甲'
  sub1: string
  sub2: string
  special: string
  material: string
}

// ─── Image mapping (equip-images.js) ──────────────────────────────────────

const EQUIP_IMAGE_MAP: Record<string, string> = {
  '长息辅助臂': 'item_equip_t4_suit_usp02_edc_03',
  '长息蓄电核·壹型': 'item_equip_t4_suit_usp02_edc_02',
  '长息蓄电核': 'item_equip_t4_suit_usp02_edc_01',
  '长息护手·壹型': 'item_equip_t4_suit_usp02_hand_01',
  '长息护手': 'item_equip_t4_suit_usp02_hand_01',
  '长息装甲': 'item_equip_t4_suit_usp02_body_01',
  '浊流切割炬': 'item_equip_t4_suit_burst01_edc_02',
  '悬河供氧栓': 'item_equip_t4_suit_burst01_edc_01',
  '潮涌手甲': 'item_equip_t4_suit_burst01_hand_01',
  '落潮轻甲': 'item_equip_t4_suit_burst01_body_01',
  '50式应龙短刃·壹型': 'item_equip_t4_suit_atk02_edc_05',
  '50式应龙短刃': 'item_equip_t4_suit_atk02_edc_04',
  '50式应龙雷达': 'item_equip_t4_suit_atk02_edc_01',
  '50式应龙护手·壹型': 'item_equip_t4_suit_atk02_hand_02',
  '50式应龙护手': 'item_equip_t4_suit_atk02_hand_01',
  '50式应龙轻甲': 'item_equip_t4_suit_atk02_body_04',
  '50式应龙重甲': 'item_equip_t4_suit_atk02_body_01',
  'M.I.警用刺刃·壹型': 'item_equip_t4_suit_criti01_edc_05',
  'M.I.警用刺刃': 'item_equip_t4_suit_criti01_edc_04',
  'M.I.警用工具组': 'item_equip_t4_suit_criti01_edc_03',
  'M.I.警用瞄具': 'item_equip_t4_suit_criti01_edc_02',
  'M.I.警用臂环': 'item_equip_t4_suit_criti01_edc_01',
  'M.I.警用手环·壹型': 'item_equip_t4_suit_criti01_hand_03',
  'M.I.警用手环': 'item_equip_t4_suit_criti01_hand_02',
  'M.I.警用手套': 'item_equip_t4_suit_criti01_hand_01',
  'M.I.警用罩衣·贰型': 'item_equip_t4_suit_criti01_body_04',
  'M.I.警用罩衣·壹型': 'item_equip_t4_suit_criti01_body_03',
  'M.I.警用罩衣': 'item_equip_t4_suit_criti01_body_02',
  'M.I.警用护甲': 'item_equip_t4_suit_criti01_body_01',
  '动火用电力匣': 'item_equip_t4_suit_fire_natr01_edc_03',
  '动火用储能匣': 'item_equip_t4_suit_fire_natr01_edc_01',
  '动火用测温镜': 'item_equip_t4_suit_fire_natr01_edc_02',
  '动火用手甲·壹型': 'item_equip_t4_suit_fire_natr01_hand_03',
  '动火用手甲': 'item_equip_t4_suit_fire_natr01_hand_02',
  '动火用外骨骼': 'item_equip_t4_suit_fire_natr01_body_01',
  '拓荒增量供氧栓': 'item_equip_t4_suit_atb01_edc_04',
  '拓荒通信器·壹型': 'item_equip_t4_suit_atb01_edc_02',
  '拓荒通信器': 'item_equip_t4_suit_atb01_edc_01',
  '拓荒耐蚀手套': 'item_equip_t4_suit_atb01_hand_01',
  '拓荒护甲·叁型': 'item_equip_t4_suit_atb01_body_04',
  '拓荒护甲·贰型': 'item_equip_t4_suit_atb01_body_03',
  '拓荒护甲·壹型': 'item_equip_t4_suit_atb01_body_02',
  '拓荒护甲': 'item_equip_t4_suit_atb01_body_01',
  '脉冲式校准器': 'item_equip_t4_suit_pulse_cryst01_edc_02',
  '脉冲式手套': 'item_equip_t4_suit_pulse_cryst01_hand_01',
  '脉冲式干扰服': 'item_equip_t4_suit_pulse_cryst01_body_01',
  '碾骨小雕像·壹型': 'item_equip_t4_suit_attri01_edc_06',
  '碾骨小雕像': 'item_equip_t4_suit_attri01_edc_03',
  '碾骨面具·壹型': 'item_equip_t4_suit_attri01_edc_05',
  '碾骨面具': 'item_equip_t4_suit_attri01_edc_04',
  '碾骨披巾·壹型': 'item_equip_t4_suit_attri01_body_04',
  '碾骨披巾': 'item_equip_t4_suit_attri01_body_03',
  '碾骨重护甲·壹型': 'item_equip_t4_suit_attri01_body_02',
  '碾骨重护甲': 'item_equip_t4_suit_attri01_body_01',
  '轻超域稳定盘': 'item_equip_t4_suit_poise01_edc_02',
  '轻超域分析环': 'item_equip_t4_suit_poise01_edc_01',
  '轻超域护手': 'item_equip_t4_suit_poise01_hand_01',
  '轻超域护板': 'item_equip_t4_suit_poise01_body_01',
  '生物辅助护盾针': 'item_equip_t4_suit_heal01_edc_04',
  '生物辅助护板': 'item_equip_t4_suit_heal01_edc_03',
  '生物辅助接驳器·壹型': 'item_equip_t4_suit_heal01_edc_05',
  '生物辅助接驳器': 'item_equip_t4_suit_heal01_edc_01',
  '生物辅助手甲': 'item_equip_t4_suit_heal01_hand_02',
  '生物辅助臂甲': 'item_equip_t4_suit_heal01_hand_01',
  '生物辅助胸甲': 'item_equip_t4_suit_heal01_body_02',
  '生物辅助重甲': 'item_equip_t4_suit_heal01_body_01',
  '点剑火石': 'item_equip_t4_suit_phy01_edc_03',
  '点剑战术手甲': 'item_equip_t4_suit_phy01_hand_02',
  '点剑战术手套': 'item_equip_t4_suit_phy01_hand_01',
  '点剑重装甲': 'item_equip_t4_suit_phy01_body_02',
  '纾难印章·壹型': 'item_equip_t4_parts_wuling01_edc_04',
  '纾难印章': 'item_equip_t4_parts_wuling01_edc_03',
  '纾难识别牌·壹型': 'item_equip_t4_parts_wuling01_edc_02',
  '纾难识别牌': 'item_equip_t4_parts_wuling01_edc_01',
  '纾难手套': 'item_equip_t4_parts_wuling01_hand_02',
  '纾难护手': 'item_equip_t4_parts_wuling01_hand_01',
  '纾难护甲': 'item_equip_t4_parts_wuling01_body_02',
  '纾难重甲': 'item_equip_t4_parts_wuling01_body_01',
  '50式应龙雷达·壹型': 'item_equip_t4_suit_atk02_edc_02',
  '50式应龙雷达·贰型': 'item_equip_t4_suit_atk02_edc_03',
  '50式应龙重甲·壹型': 'item_equip_t4_suit_atk02_body_02',
  '50式应龙重甲·贰型': 'item_equip_t4_suit_atk02_body_03',
  'M.I.警用瞄具·壹型': 'item_equip_t4_suit_criti01_edc_06',
  'M.I.警用手套·壹型': 'item_equip_t4_suit_criti01_hand_04',
  'M.I.警用护甲·壹型': 'item_equip_t4_suit_criti01_body_06',
  '动火用手套': 'item_equip_t4_suit_fire_natr01_hand_01',
  '动火用辅助骨骼': 'item_equip_t4_suit_fire_natr01_body_02',
  '拓荒供氧栓': 'item_equip_t4_suit_atb01_edc_05',
  '拓荒分析仪': 'item_equip_t4_suit_atb01_edc_03',
  '拓荒纤维手套': 'item_equip_t4_suit_atb01_hand_02',
  '拓荒护服': 'item_equip_t4_suit_atb01_body_05',
  '脉冲式侵入核': 'item_equip_t4_suit_pulse_cryst01_edc_03',
  '脉冲式探针': 'item_equip_t4_suit_pulse_cryst01_edc_01',
  '碾骨面具·贰型': 'item_equip_t4_suit_attri01_edc_07',
  '碾骨腕带·壹型': 'item_equip_t4_suit_attri01_hand_02',
  '碾骨腕带': 'item_equip_t4_suit_attri01_hand_01',
  '碾骨重护甲·贰型': 'item_equip_t4_suit_attri01_body_05',
  '轻超域稳定盘·壹型': 'item_equip_t4_suit_poise01_edc_03',
  '轻超域腕表': 'item_equip_t4_suit_poise01_edc_04',
  '轻超域轻护手': 'item_equip_t4_suit_poise01_hand_02',
  '生物辅助接驳器·贰型': 'item_equip_t4_suit_heal01_edc_02',
  '点剑定位信标': 'item_equip_t4_suit_phy01_edc_01',
  '点剑微型滤芯': 'item_equip_t4_suit_phy01_edc_02',
  '点剑轻装甲': 'item_equip_t4_suit_phy01_body_01',
  '清波重甲': 'item_equip_t4_suit_combo_cd01_body_01',
  '清波轻甲': 'item_equip_t4_suit_combo_cd01_body_02',
  '清波手甲': 'item_equip_t4_suit_combo_cd01_hand_01',
  '清波护手': 'item_equip_t4_suit_combo_cd01_hand_02',
  '清波定位仪': 'item_equip_t4_suit_combo_cd01_edc_01',
  '清波竹刃': 'item_equip_t4_suit_combo_cd01_edc_02',
  '清波水罐': 'item_equip_t4_suit_combo_cd01_edc_03',
  '壤流轻甲': 'item_equip_t4_suit_expend_spell01_body_02',
  '壤流护手': 'item_equip_t4_suit_expend_spell01_hand_02',
  '壤流短棍': 'item_equip_t4_suit_expend_spell01_edc_02',
  '拓荒纤维手套·壹型': 'item_equip_t4_suit_atb01_hand_03',
  '拓荒增量供氧栓·壹型': 'item_equip_t4_suit_atb01_edc_06',
  '碾骨手套': 'item_equip_t4_suit_attri01_hand_03',
  '碾骨小雕像·贰型': 'item_equip_t4_suit_attri01_edc_02',
  '点剑重装甲·壹型': 'item_equip_t4_suit_phy01_body_03',
  '点剑战术手甲·壹型': 'item_equip_t4_suit_phy01_hand_03',
  '点剑短刃': 'item_equip_t4_suit_phy01_edc_04',
}

// ─── Raw equip data ───────────────────────────────────────────────────────

const RAW_EQUIPS: RawEquip[] = [
  { name: '长息辅助臂', set: '长息', rarity: 5, type: '配件', sub1: '意志+32', sub2: '智识+21', special: '终结技充能效率+24.6%', material: '息壤' },
  { name: '长息蓄电核·壹型', set: '长息', rarity: 5, type: '配件', sub1: '智识+32', sub2: '意志+21', special: '治疗效率加成+20.7%', material: '息壤' },
  { name: '长息蓄电核', set: '长息', rarity: 5, type: '配件', sub1: '智识+32', sub2: '力量+21', special: '终结技充能效率+24.6%', material: '息壤' },
  { name: '长息护手·壹型', set: '长息', rarity: 5, type: '护手', sub1: '智识+65', sub2: '意志+43', special: '终结技充能效率+20.5%', material: '息壤' },
  { name: '长息护手', set: '长息', rarity: 5, type: '护手', sub1: '智识+65', sub2: '力量+43', special: '终结技充能效率+20.5%', material: '息壤' },
  { name: '长息装甲', set: '长息', rarity: 5, type: '护甲', sub1: '意志+87', sub2: '智识+58', special: '源石技艺强度+20', material: '息壤' },
  { name: '浊流切割炬', set: '潮涌', rarity: 5, type: '配件', sub1: '智识+32', sub2: '力量+21', special: '普通攻击伤害加成+27.6%', material: '息壤' },
  { name: '悬河供氧栓', set: '潮涌', rarity: 5, type: '配件', sub1: '力量+32', sub2: '意志+21', special: '寒冷和电磁伤害+23.0%', material: '息壤' },
  { name: '潮涌手甲', set: '潮涌', rarity: 5, type: '护手', sub1: '力量+65', sub2: '意志+43', special: '寒冷和电磁伤害+19.2%', material: '息壤' },
  { name: '落潮轻甲', set: '潮涌', rarity: 5, type: '护甲', sub1: '智识+87', sub2: '力量+58', special: '终结技充能效率+12.3%', material: '息壤' },
  { name: '50式应龙短刃·壹型', set: '50式应龙', rarity: 5, type: '配件', sub1: '智识+32', sub2: '力量+21', special: '所有技能伤害加成+27.6%', material: '息壤' },
  { name: '50式应龙短刃', set: '50式应龙', rarity: 5, type: '配件', sub1: '意志+32', sub2: '敏捷+21', special: '连携技伤害加成+41.4%', material: '息壤' },
  { name: '50式应龙雷达', set: '50式应龙', rarity: 5, type: '配件', sub1: '力量+32', sub2: '意志+21', special: '物理伤害加成+23.0%', material: '息壤' },
  { name: '50式应龙护手·壹型', set: '50式应龙', rarity: 5, type: '护手', sub1: '意志+65', sub2: '敏捷+43', special: '连携技伤害加成+34.5%', material: '息壤' },
  { name: '50式应龙护手', set: '50式应龙', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '智识+43', special: '连携技伤害加成+34.5%', material: '息壤' },
  { name: '50式应龙轻甲', set: '50式应龙', rarity: 5, type: '护甲', sub1: '意志+87', sub2: '力量+58', special: '所有技能伤害加成+13.8%', material: '息壤' },
  { name: '50式应龙重甲', set: '50式应龙', rarity: 5, type: '护甲', sub1: '力量+87', sub2: '意志+58', special: '物理伤害加成+11.5%', material: '息壤' },
  { name: 'M.I.警用刺刃·壹型', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '意志+32', sub2: '敏捷+21', special: '战技伤害加成+41.4%', material: '息壤' },
  { name: 'M.I.警用刺刃', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '意志+32', sub2: '智识+21', special: '灼热和自然伤害+23.0%', material: '息壤' },
  { name: 'M.I.警用工具组', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '智识+32', sub2: '敏捷+21', special: '暴击率+10.4%', material: '息壤' },
  { name: 'M.I.警用瞄具', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '战技伤害加成+41.4%', material: '息壤' },
  { name: 'M.I.警用臂环', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '力量+32', sub2: '意志+21', special: '寒冷和电磁伤害+23.0%', material: '息壤' },
  { name: 'M.I.警用手环·壹型', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '智识+65', sub2: '意志+43', special: '暴击率+8.6%', material: '息壤' },
  { name: 'M.I.警用手环', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '智识+65', sub2: '敏捷+43', special: '普通攻击伤害加成+23.0%', material: '息壤' },
  { name: 'M.I.警用手套', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '力量+43', special: '战技伤害加成+34.5%', material: '息壤' },
  { name: 'M.I.警用罩衣·贰型', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '意志+87', sub2: '敏捷+58', special: '战技伤害加成+20.7%', material: '息壤' },
  { name: 'M.I.警用罩衣·壹型', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '智识+87', sub2: '意志+58', special: '暴击率+5.2%', material: '息壤' },
  { name: 'M.I.警用罩衣', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '智识+87', sub2: '敏捷+58', special: '普通攻击伤害加成+13.8%', material: '息壤' },
  { name: 'M.I.警用护甲', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '力量+58', special: '源石技艺强度+20', material: '息壤' },
  { name: '动火用电力匣', set: '动火用', rarity: 5, type: '配件', sub1: '意志+32', sub2: '智识+21', special: '源石技艺强度+41', material: '息壤' },
  { name: '动火用储能匣', set: '动火用', rarity: 5, type: '配件', sub1: '力量+32', sub2: '敏捷+21', special: '源石技艺强度+41', material: '息壤' },
  { name: '动火用测温镜', set: '动火用', rarity: 5, type: '配件', sub1: '智识+41', sub2: '', special: '战技伤害加成+41.4%', material: '息壤' },
  { name: '动火用手甲·壹型', set: '动火用', rarity: 5, type: '护手', sub1: '意志+65', sub2: '智识+43', special: '灼热和自然伤害+19.2%', material: '息壤' },
  { name: '动火用手甲', set: '动火用', rarity: 5, type: '护手', sub1: '智识+65', sub2: '力量+43', special: '灼热和自然伤害+19.2%', material: '息壤' },
  { name: '动火用外骨骼', set: '动火用', rarity: 5, type: '护甲', sub1: '力量+87', sub2: '敏捷+58', special: '灼热和自然伤害+11.5%', material: '息壤' },
  { name: '拓荒增量供氧栓', set: '拓荒', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '智识+21', special: '副能力+20.7%', material: '息壤' },
  { name: '拓荒通信器·壹型', set: '拓荒', rarity: 5, type: '配件', sub1: '力量+32', sub2: '智识+21', special: '寒冷和电磁伤害+23.0%', material: '息壤' },
  { name: '拓荒通信器', set: '拓荒', rarity: 5, type: '配件', sub1: '力量+32', sub2: '敏捷+21', special: '连携技伤害加成+41.4%', material: '息壤' },
  { name: '拓荒耐蚀手套', set: '拓荒', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '智识+43', special: '战技伤害加成+34.5%', material: '息壤' },
  { name: '拓荒护甲·叁型', set: '拓荒', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '智识+58', special: '副能力+10.4%', material: '息壤' },
  { name: '拓荒护甲·贰型', set: '拓荒', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '智识+58', special: '战技伤害加成+20.7%', material: '息壤' },
  { name: '拓荒护甲·壹型', set: '拓荒', rarity: 5, type: '护甲', sub1: '力量+87', sub2: '敏捷+58', special: '战技伤害加成+20.7%', material: '息壤' },
  { name: '拓荒护甲', set: '拓荒', rarity: 5, type: '护甲', sub1: '力量+87', sub2: '智识+58', special: '终结技伤害加成+25.9%', material: '息壤' },
  { name: '脉冲式校准器', set: '脉冲式', rarity: 5, type: '配件', sub1: '智识+41', sub2: '', special: '源石技艺强度+41', material: '息壤' },
  { name: '脉冲式手套', set: '脉冲式', rarity: 5, type: '护手', sub1: '意志+65', sub2: '智识+43', special: '寒冷和电磁伤害+19.2%', material: '息壤' },
  { name: '脉冲式干扰服', set: '脉冲式', rarity: 5, type: '护甲', sub1: '智识+87', sub2: '意志+58', special: '源石技艺强度+20', material: '息壤' },
  { name: '碾骨小雕像·壹型', set: '碾骨', rarity: 5, type: '配件', sub1: '意志+32', sub2: '智识+21', special: '连携技伤害加成+41.4%', material: '息壤' },
  { name: '碾骨小雕像', set: '碾骨', rarity: 5, type: '配件', sub1: '意志+32', sub2: '敏捷+21', special: '战技伤害加成+41.4%', material: '息壤' },
  { name: '碾骨面具·壹型', set: '碾骨', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '暴击率+10.4%', material: '息壤' },
  { name: '碾骨面具', set: '碾骨', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '对失衡目标加成+44.1%', material: '息壤' },
  { name: '碾骨披巾·壹型', set: '碾骨', rarity: 5, type: '护甲', sub1: '意志+87', sub2: '敏捷+58', special: '终结技充能效率+12.3%', material: '息壤' },
  { name: '碾骨披巾', set: '碾骨', rarity: 5, type: '护甲', sub1: '意志+87', sub2: '力量+58', special: '连携技伤害加成+20.7%', material: '息壤' },
  { name: '碾骨重护甲·壹型', set: '碾骨', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '力量+58', special: '连携技伤害加成+20.7%', material: '息壤' },
  { name: '碾骨重护甲', set: '碾骨', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '智识+58', special: '终结技充能效率+12.3%', material: '息壤' },
  { name: '轻超域稳定盘', set: '轻超域', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '源石技艺强度+41', material: '息壤' },
  { name: '轻超域分析环', set: '轻超域', rarity: 5, type: '配件', sub1: '力量+32', sub2: '意志+21', special: '物理伤害加成+23.0%', material: '息壤' },
  { name: '轻超域护手', set: '轻超域', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '力量+43', special: '源石技艺强度+34', material: '息壤' },
  { name: '轻超域护板', set: '轻超域', rarity: 5, type: '护甲', sub1: '力量+87', sub2: '意志+58', special: '对失衡目标加成+20.7%', material: '息壤' },
  { name: '生物辅助护盾针', set: '生物辅助', rarity: 5, type: '配件', sub1: '意志+41', sub2: '', special: '治疗效率加成+20.7%', material: '息壤' },
  { name: '生物辅助护板', set: '生物辅助', rarity: 5, type: '配件', sub1: '意志+32', sub2: '智识+21', special: '主能力+20.7%', material: '息壤' },
  { name: '生物辅助接驳器·壹型', set: '生物辅助', rarity: 5, type: '配件', sub1: '力量+32', sub2: '意志+21', special: '生命值+41.4%', material: '息壤' },
  { name: '生物辅助接驳器', set: '生物辅助', rarity: 5, type: '配件', sub1: '力量+32', sub2: '意志+21', special: '全伤害减免 17.2%', material: '息壤' },
  { name: '生物辅助手甲', set: '生物辅助', rarity: 5, type: '护手', sub1: '意志+65', sub2: '力量+43', special: '治疗效率加成+17.3%', material: '息壤' },
  { name: '生物辅助臂甲', set: '生物辅助', rarity: 5, type: '护手', sub1: '力量+65', sub2: '意志+43', special: '终结技充能效率+20.5%', material: '息壤' },
  { name: '生物辅助胸甲', set: '生物辅助', rarity: 5, type: '护甲', sub1: '意志+87', sub2: '智识+58', special: '治疗效率加成+10.4%', material: '息壤' },
  { name: '生物辅助重甲', set: '生物辅助', rarity: 5, type: '护甲', sub1: '力量+87', sub2: '意志+58', special: '治疗效率加成+10.4%', material: '息壤' },
  { name: '点剑火石', set: '点剑', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '物理伤害加成+23.0%', material: '息壤' },
  { name: '点剑战术手甲', set: '点剑', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '力量+43', special: '终结技伤害加成+43.1%', material: '息壤' },
  { name: '点剑战术手套', set: '点剑', rarity: 5, type: '护手', sub1: '力量+65', sub2: '意志+43', special: '物理伤害加成+19.2%', material: '息壤' },
  { name: '点剑重装甲', set: '点剑', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '力量+58', special: '源石技艺强度+20', material: '息壤' },
  { name: '纾难印章·壹型', set: '独立装备', rarity: 5, type: '配件', sub1: '意志+43', sub2: '', special: '暴击率+10.8%', material: '息壤' },
  { name: '纾难印章', set: '独立装备', rarity: 5, type: '配件', sub1: '智识+43', sub2: '', special: '终结技充能效率+25.7%', material: '息壤' },
  { name: '纾难识别牌·壹型', set: '独立装备', rarity: 5, type: '配件', sub1: '敏捷+43', sub2: '', special: '连携技伤害加成+43.2%', material: '息壤' },
  { name: '纾难识别牌', set: '独立装备', rarity: 5, type: '配件', sub1: '力量+43', sub2: '', special: '全伤害减免 17.8%', material: '息壤' },
  { name: '纾难手套', set: '独立装备', rarity: 5, type: '护手', sub1: '力量+86', sub2: '', special: '所有技能伤害加成+24.0%', material: '赤铜' },
  { name: '纾难护手', set: '独立装备', rarity: 5, type: '护手', sub1: '敏捷+86', sub2: '', special: '终结技伤害加成+45.0%', material: '赤铜' },
  { name: '纾难护甲', set: '独立装备', rarity: 5, type: '护甲', sub1: '智识+115', sub2: '', special: '终结技充能效率+12.9%', material: '赤铜' },
  { name: '纾难重甲', set: '独立装备', rarity: 5, type: '护甲', sub1: '敏捷+115', sub2: '', special: '普通攻击伤害加成+14.4%', material: '赤铜' },
  { name: '50式应龙雷达·壹型', set: '50式应龙', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '终结技伤害加成+51.8%', material: '赤铜' },
  { name: '50式应龙雷达·贰型', set: '50式应龙', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '智识+21', special: '连携技伤害加成+41.4%', material: '赤铜' },
  { name: '50式应龙重甲·壹型', set: '50式应龙', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '力量+58', special: '终结技充能效率+12.3%', material: '赤铜' },
  { name: '50式应龙重甲·贰型', set: '50式应龙', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '智识+58', special: '连携技伤害加成+20.7%', material: '赤铜' },
  { name: 'M.I.警用瞄具·壹型', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '智识+21', special: '暴击率+10.4%', material: '赤铜' },
  { name: 'M.I.警用手套·壹型', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '智识+43', special: '终结技伤害加成+43.1%', material: '赤铜' },
  { name: 'M.I.警用护甲·壹型', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '智识+58', special: '终结技充能效率+12.3%', material: '赤铜' },
  { name: '动火用手套', set: '动火用', rarity: 5, type: '护手', sub1: '力量+65', sub2: '意志+43', special: '源石技艺强度+34', material: '赤铜' },
  { name: '动火用辅助骨骼', set: '动火用', rarity: 5, type: '护甲', sub1: '智识+87', sub2: '意志+58', special: '灼热和自然伤害+11.5%', material: '赤铜' },
  { name: '拓荒供氧栓', set: '拓荒', rarity: 5, type: '配件', sub1: '意志+41', sub2: '', special: '物理伤害加成+23.0%', material: '赤铜' },
  { name: '拓荒分析仪', set: '拓荒', rarity: 5, type: '配件', sub1: '力量+41', sub2: '', special: '终结技伤害加成+51.8%', material: '赤铜' },
  { name: '拓荒纤维手套', set: '拓荒', rarity: 5, type: '护手', sub1: '意志+65', sub2: '力量+43', special: '所有技能伤害加成+23.0%', material: '赤铜' },
  { name: '拓荒护服', set: '拓荒', rarity: 5, type: '护甲', sub1: '智识+87', sub2: '敏捷+58', special: '终结技充能效率+12.3%', material: '赤铜' },
  { name: '脉冲式侵入核', set: '脉冲式', rarity: 5, type: '配件', sub1: '意志+41', sub2: '', special: '终结技伤害加成+51.8%', material: '赤铜' },
  { name: '脉冲式探针', set: '脉冲式', rarity: 5, type: '配件', sub1: '智识+32', sub2: '敏捷+21', special: '源石技艺强度+41', material: '赤铜' },
  { name: '碾骨面具·贰型', set: '碾骨', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '战技伤害加成+41.4%', material: '赤铜' },
  { name: '碾骨腕带·壹型', set: '碾骨', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '力量+43', special: '寒冷和电磁伤害+19.2%', material: '赤铜' },
  { name: '碾骨腕带', set: '碾骨', rarity: 5, type: '护手', sub1: '力量+65', sub2: '敏捷+43', special: '灼热和自然伤害+19.2%', material: '赤铜' },
  { name: '碾骨重护甲·贰型', set: '碾骨', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '力量+58', special: '寒冷和电磁伤害+11.5%', material: '赤铜' },
  { name: '轻超域稳定盘·壹型', set: '轻超域', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '物理伤害加成+23.0%', material: '赤铜' },
  { name: '轻超域腕表', set: '轻超域', rarity: 5, type: '配件', sub1: '力量+32', sub2: '敏捷+21', special: '战技伤害加成+41.4%', material: '赤铜' },
  { name: '轻超域轻护手', set: '轻超域', rarity: 5, type: '护手', sub1: '意志+65', sub2: '敏捷+43', special: '所有技能伤害加成+23.0%', material: '赤铜' },
  { name: '生物辅助接驳器·贰型', set: '生物辅助', rarity: 5, type: '配件', sub1: '力量+41', sub2: '', special: '生命值+41.4%', material: '赤铜' },
  { name: '点剑定位信标', set: '点剑', rarity: 5, type: '配件', sub1: '力量+41', sub2: '', special: '源石技艺强度+41', material: '赤铜' },
  { name: '点剑微型滤芯', set: '点剑', rarity: 5, type: '配件', sub1: '力量+32', sub2: '意志+21', special: '物理伤害加成+23.0%', material: '赤铜' },
  { name: '点剑轻装甲', set: '点剑', rarity: 5, type: '护甲', sub1: '力量+87', sub2: '意志+58', special: '终结技充能效率+12.3%', material: '赤铜' },
  { name: '清波重甲', set: '清波', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '力量+58', special: '终结技充能效率+12.3%', material: '赫铜' },
  { name: '清波轻甲', set: '清波', rarity: 5, type: '护甲', sub1: '智识+87', sub2: '意志+58', special: '源石技艺强度+20', material: '赫铜' },
  { name: '清波手甲', set: '清波', rarity: 5, type: '护手', sub1: '敏捷+65', sub2: '力量+43', special: '所有技能伤害加成+23.0%', material: '赫铜' },
  { name: '清波护手', set: '清波', rarity: 5, type: '护手', sub1: '智识+65', sub2: '意志+43', special: '终结技充能效率+20.5%', material: '赫铜' },
  { name: '清波定位仪', set: '清波', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '战技伤害加成+41.4%', material: '赫铜' },
  { name: '清波竹刃', set: '清波', rarity: 5, type: '配件', sub1: '力量+32', sub2: '敏捷+21', special: '灼热和自然伤害+23.0%', material: '赫铜' },
  { name: '清波水罐', set: '清波', rarity: 5, type: '配件', sub1: '智识+32', sub2: '意志+21', special: '源石技艺强度+41', material: '赫铜' },
  { name: '壤流轻甲', set: '壤流', rarity: 5, type: '护甲', sub1: '意志+87', sub2: '智识+58', special: '寒冷和电磁伤害+11.5%', material: '赫铜' },
  { name: '壤流护手', set: '壤流', rarity: 5, type: '护手', sub1: '意志+65', sub2: '智识+43', special: '寒冷和电磁伤害+19.2%', material: '赫铜' },
  { name: '壤流短棍', set: '壤流', rarity: 5, type: '配件', sub1: '意志+32', sub2: '智识+21', special: '战技伤害加成+41.4%', material: '赫铜' },
  { name: '拓荒纤维手套·壹型', set: '拓荒', rarity: 5, type: '护手', sub1: '智识+65', sub2: '敏捷+43', special: '终结技充能效率+20.5%', material: '赫铜' },
  { name: '拓荒增量供氧栓·壹型', set: '拓荒', rarity: 5, type: '配件', sub1: '智识+32', sub2: '敏捷+21', special: '副能力+20.7%', material: '赫铜' },
  { name: '碾骨手套', set: '碾骨', rarity: 5, type: '护手', sub1: '意志+65', sub2: '敏捷+43', special: '寒冷和电磁伤害+19.2%', material: '赫铜' },
  { name: '碾骨小雕像·贰型', set: '碾骨', rarity: 5, type: '配件', sub1: '意志+32', sub2: '智识+21', special: '战技伤害加成+41.4%', material: '赫铜' },
  { name: '点剑重装甲·壹型', set: '点剑', rarity: 5, type: '护甲', sub1: '敏捷+87', sub2: '力量+58', special: '物理伤害加成+11.5%', material: '赫铜' },
  { name: '点剑战术手甲·壹型', set: '点剑', rarity: 5, type: '护手', sub1: '力量+65', sub2: '意志+43', special: '源石技艺强度+34', material: '赫铜' },
  { name: '点剑短刃', set: '点剑', rarity: 5, type: '配件', sub1: '敏捷+32', sub2: '力量+21', special: '终结技伤害加成+51.8%', material: '赫铜' },
]

// ─── Parse helpers ─────────────────────────────────────────────────────────

/**
 * Parse an attribute string like "意志+32" or "终结技充能效率+24.6%"
 * into a structured ParsedStat.
 */
function parseAttr(raw: string): ParsedStat | null {
  const text = String(raw || '').trim()
  if (!text) return null

  // Normalize whitespace: "全伤害减免 17.8%" → "全伤害减免 17.8%"
  const normalized = text.replace(/\s+/g, ' ').trim()

  // Match: name + optional space + number with optional decimal + optional %
  const match = normalized.match(/^(.*?)\s*([-+]?\d+(?:\.\d+)?)(%)?$/)
  if (!match) {
    // Can't parse the value, store as display-only
    return {
      stat: normalized,
      value: 0,
      unit: '',
      display: normalized,
    }
  }

  const stat = String(match[1] || '').replace(/\+$/g, '').trim()
  const value = Number(match[2])
  const unit = match[3] || ''

  return {
    stat: stat || normalized,
    value: Number.isFinite(value) ? value : 0,
    unit,
    display: normalized,
  }
}

/** Generate a stable kebab-case ID from set name + equip name */
function generateId(setName: string, name: string): string {
  const raw = `${setName}-${name}`
  return raw
    .replace(/[·．]/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

// ─── Build equips ──────────────────────────────────────────────────────────

function buildEquips(): Equip[] {
  const seen = new Set<string>()
  const result: Equip[] = []

  for (const raw of RAW_EQUIPS) {
    const id = generateId(raw.set, raw.name)

    // Handle duplicate IDs by appending a counter
    let uniqueId = id
    let counter = 1
    while (seen.has(uniqueId)) {
      uniqueId = `${id}-${counter}`
      counter++
    }
    seen.add(uniqueId)

    const sub1 = parseAttr(raw.sub1)
    const sub2 = parseAttr(raw.sub2)
    const special = parseAttr(raw.special)
    const imageId = EQUIP_IMAGE_MAP[raw.name] || ''

    result.push({
      id: uniqueId,
      name: raw.name,
      setName: raw.set,
      rarity: raw.rarity,
      type: raw.type,
      sub1,
      sub2,
      special,
      material: raw.material,
      imageId,
    })
  }

  return result
}

// ─── Variant-aware sorting ───────────────────────────────────────────────

/** Map Chinese numeral characters to integer order */
const VARIANT_NUM: Record<string, number> = {
  '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5,
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
}

/** Extract the base name (before '·'). Returns full name if no variant separator */
function baseName(name: string): string {
  const idx = name.indexOf('·')
  return idx === -1 ? name : name.slice(0, idx)
}

/** Extract variant order number from name (0 = no variant) */
function variantOrder(name: string): number {
  const idx = name.indexOf('·')
  if (idx === -1) return 0
  const variant = name.slice(idx)
  for (const [char, num] of Object.entries(VARIANT_NUM)) {
    if (variant.includes(char)) return num
  }
  return 0
}

// Sort equips: setName → baseName → variant order → full name
const sortedEquips = buildEquips().sort((a, b) => {
  const setDiff = a.setName.localeCompare(b.setName, 'zh-CN')
  if (setDiff !== 0) return setDiff
  const baseA = baseName(a.name)
  const baseB = baseName(b.name)
  const baseDiff = baseA.localeCompare(baseB, 'zh-CN')
  if (baseDiff !== 0) return baseDiff
  const vDiff = variantOrder(a.name) - variantOrder(b.name)
  if (vDiff !== 0) return vDiff
  return a.name.localeCompare(b.name, 'zh-CN')
})

export const equips: Equip[] = sortedEquips

// ─── Precomputed indexes ───────────────────────────────────────────────────

/** Equip lookup by id */
export const equipById: Map<string, Equip> = new Map(equips.map((e) => [e.id, e]))

/** All unique set names, sorted alphabetically (zh-CN) */
export const setNames: string[] = [
  ...new Set(equips.map((e) => e.setName)),
].sort((a, b) => a.localeCompare(b, 'zh-CN'))

/** Equips grouped by set */
export const equipsBySet: Map<string, Equip[]> = (() => {
  const map = new Map<string, Equip[]>()
  for (const e of equips) {
    const arr = map.get(e.setName)
    if (arr) {
      arr.push(e)
    } else {
      map.set(e.setName, [e])
    }
  }
  return map
})()

/** All unique material values, in first-appearance order */
export const materialOptions: string[] = [
  ...new Set(equips.map((e) => e.material)),
]

/** All unique sub1 stat names (for filter) */
export const sub1StatOptions: string[] = [
  ...new Set(
    equips
      .map((e) => e.sub1?.stat)
      .filter((s): s is string => !!s),
  ),
].sort()

/** All unique sub2 stat names (for filter) */
export const sub2StatOptions: string[] = [
  ...new Set(
    equips
      .map((e) => e.sub2?.stat)
      .filter((s): s is string => !!s),
  ),
].sort()

/** All unique special stat names (for filter) */
export const specialStatOptions: string[] = [
  ...new Set(
    equips
      .map((e) => e.special?.stat)
      .filter((s): s is string => !!s),
  ),
].sort()
