import type { Equip, EquipVoucher, ParsedStat } from '@/types/refinement'


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
  /** 调度券消耗，格式 "名称x数量"，如 "谷地调度券x9600" */
  voucher: string
  equipId: string
  iconId: string
}


// ─── Raw equip data ───────────────────────────────────────────────────────


const RAW_EQUIPS: RawEquip[] = [
  { name: '拓荒护甲', set: '拓荒', rarity: 5, type: '护甲', sub1: '39+87', sub2: '41+58', special: '28+25.875%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_body_01', iconId: 'item_equip_t4_suit_atb01_body_01' },
  { name: '拓荒护甲·壹型', set: '拓荒', rarity: 5, type: '护甲', sub1: '39+87', sub2: '40+58', special: '32+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_body_02', iconId: 'item_equip_t4_suit_atb01_body_03' },
  { name: '拓荒护甲·贰型', set: '拓荒', rarity: 5, type: '护甲', sub1: '40+87', sub2: '41+58', special: '32+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_body_03', iconId: 'item_equip_t4_suit_atb01_body_04' },
  { name: '拓荒护甲·叁型', set: '拓荒', rarity: 5, type: '护甲', sub1: '40+87', sub2: '41+58', special: 'Sub+10.35089175%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_body_04', iconId: 'item_equip_t4_suit_atb01_body_02' },
  { name: '拓荒护服', set: '拓荒', rarity: 5, type: '护甲', sub1: '41+87', sub2: '40+58', special: '44+12.32142857%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atb01_body_05', iconId: 'item_equip_t4_suit_atb01_body_05' },
  { name: '拓荒耐蚀手套', set: '拓荒', rarity: 5, type: '护手', sub1: '40+65', sub2: '41+43', special: '32+34.5%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_hand_01', iconId: 'item_equip_t4_suit_atb01_hand_01' },
  { name: '拓荒纤维手套', set: '拓荒', rarity: 5, type: '护手', sub1: '42+65', sub2: '39+43', special: 'AllSkillDamageIncrease+23%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atb01_hand_02', iconId: 'item_equip_t4_suit_atb01_hand_02' },
  { name: '拓荒通信器', set: '拓荒', rarity: 5, type: '配件', sub1: '39+32', sub2: '40+21', special: '33+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_edc_01', iconId: 'item_equip_t4_suit_atb01_edc_01' },
  { name: '拓荒通信器·壹型', set: '拓荒', rarity: 5, type: '配件', sub1: '39+32', sub2: '41+21', special: 'CrystAndPulseDamageIncrease+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_edc_02', iconId: 'item_equip_t4_suit_atb01_edc_02' },
  { name: '拓荒分析仪', set: '拓荒', rarity: 5, type: '配件', sub1: '39+41', sub2: '', special: '28+51.75%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atb01_edc_03', iconId: 'item_equip_t4_suit_atb01_edc_03' },
  { name: '拓荒增量供氧栓', set: '拓荒', rarity: 5, type: '配件', sub1: '40+32', sub2: '41+21', special: 'Sub+20.7017835%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atb01_edc_04', iconId: 'item_equip_t4_suit_atb01_edc_04' },
  { name: '拓荒供氧栓', set: '拓荒', rarity: 5, type: '配件', sub1: '42+41', sub2: '', special: '50+23%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atb01_edc_05', iconId: 'item_equip_t4_suit_atb01_edc_05' },
  { name: '拓荒纤维手套·壹型', set: '拓荒', rarity: 5, type: '护手', sub1: '41+65', sub2: '40+43', special: '44+20.53571429%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_atb01_hand_03', iconId: 'item_equip_t4_suit_atb01_hand_03' },
  { name: '拓荒增量供氧栓·壹型', set: '拓荒', rarity: 5, type: '配件', sub1: '41+32', sub2: '40+21', special: 'Sub+20.7017835%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_atb01_edc_06', iconId: 'item_equip_t4_suit_atb01_edc_06' },
  { name: '50式应龙重甲', set: '50式应龙', rarity: 5, type: '护甲', sub1: '39+87', sub2: '42+58', special: '50+11.5%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atk02_body_01', iconId: 'item_equip_t4_suit_atk02_body_01' },
  { name: '50式应龙重甲·壹型', set: '50式应龙', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: '44+12.32142857%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atk02_body_02', iconId: 'item_equip_t4_suit_atk02_body_02' },
  { name: '50式应龙重甲·贰型', set: '50式应龙', rarity: 5, type: '护甲', sub1: '40+87', sub2: '41+58', special: '33+20.7%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atk02_body_03', iconId: 'item_equip_t4_suit_atk02_body_03' },
  { name: '50式应龙轻甲', set: '50式应龙', rarity: 5, type: '护甲', sub1: '42+87', sub2: '39+58', special: 'AllSkillDamageIncrease+13.8%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atk02_body_04', iconId: 'item_equip_t4_suit_atk02_body_04' },
  { name: '50式应龙护手', set: '50式应龙', rarity: 5, type: '护手', sub1: '40+65', sub2: '41+43', special: '33+34.5%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atk02_hand_01', iconId: 'item_equip_t4_suit_atk02_hand_01' },
  { name: '50式应龙护手·壹型', set: '50式应龙', rarity: 5, type: '护手', sub1: '42+65', sub2: '40+43', special: '33+34.5%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atk02_hand_02', iconId: 'item_equip_t4_suit_atk02_hand_01' },
  { name: '50式应龙雷达', set: '50式应龙', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: '50+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atk02_edc_01', iconId: 'item_equip_t4_suit_atk02_edc_01' },
  { name: '50式应龙雷达·壹型', set: '50式应龙', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '28+51.75%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atk02_edc_02', iconId: 'item_equip_t4_suit_atk02_edc_02' },
  { name: '50式应龙雷达·贰型', set: '50式应龙', rarity: 5, type: '配件', sub1: '40+32', sub2: '41+21', special: '33+41.4%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_atk02_edc_03', iconId: 'item_equip_t4_suit_atk02_edc_03' },
  { name: '50式应龙短刃', set: '50式应龙', rarity: 5, type: '配件', sub1: '42+32', sub2: '40+21', special: '33+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atk02_edc_04', iconId: 'item_equip_t4_suit_atk02_edc_04' },
  { name: '50式应龙短刃·壹型', set: '50式应龙', rarity: 5, type: '配件', sub1: '41+32', sub2: '39+21', special: 'AllSkillDamageIncrease+27.6%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_atk02_edc_05', iconId: 'item_equip_t4_suit_atk02_edc_05' },
  { name: '碾骨重护甲', set: '碾骨', rarity: 5, type: '护甲', sub1: '40+87', sub2: '41+58', special: '44+12.32142857%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_body_01', iconId: 'item_equip_t4_suit_attri01_body_01' },
  { name: '碾骨重护甲·壹型', set: '碾骨', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: '33+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_body_02', iconId: 'item_equip_t4_suit_attri01_body_02' },
  { name: '碾骨披巾', set: '碾骨', rarity: 5, type: '护甲', sub1: '42+87', sub2: '39+58', special: '33+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_body_03', iconId: 'item_equip_t4_suit_attri01_body_04' },
  { name: '碾骨披巾·壹型', set: '碾骨', rarity: 5, type: '护甲', sub1: '42+87', sub2: '40+58', special: '44+12.32142857%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_body_04', iconId: 'item_equip_t4_suit_attri01_body_04' },
  { name: '碾骨腕带', set: '碾骨', rarity: 5, type: '护手', sub1: '39+65', sub2: '40+43', special: 'FireAndNaturalDamageIncrease+19.16666667%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_attri01_hand_01', iconId: 'item_equip_t4_suit_attri01_hand_01' },
  { name: '碾骨腕带·壹型', set: '碾骨', rarity: 5, type: '护手', sub1: '40+65', sub2: '39+43', special: 'CrystAndPulseDamageIncrease+19.16666667%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_attri01_hand_02', iconId: 'item_equip_t4_suit_attri01_hand_02' },
  { name: '碾骨小雕像', set: '碾骨', rarity: 5, type: '配件', sub1: '42+32', sub2: '40+21', special: '32+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_edc_03', iconId: 'item_equip_t4_suit_attri01_edc_06' },
  { name: '碾骨面具', set: '碾骨', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '61+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_edc_04', iconId: 'item_equip_t4_suit_attri01_edc_04' },
  { name: '碾骨面具·壹型', set: '碾骨', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '9+10.35%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_edc_05', iconId: 'item_equip_t4_suit_attri01_edc_05' },
  { name: '碾骨小雕像·壹型', set: '碾骨', rarity: 5, type: '配件', sub1: '42+32', sub2: '41+21', special: '33+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_attri01_edc_06', iconId: 'item_equip_t4_suit_attri01_edc_06' },
  { name: '碾骨面具·贰型', set: '碾骨', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '32+41.4%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_attri01_edc_07', iconId: 'item_equip_t4_suit_attri01_edc_07' },
  { name: '碾骨重护甲·贰型', set: '碾骨', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: 'CrystAndPulseDamageIncrease+11.5%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_attri01_body_05', iconId: 'item_equip_t4_suit_attri01_body_05' },
  { name: '碾骨手套', set: '碾骨', rarity: 5, type: '护手', sub1: '42+65', sub2: '40+43', special: 'CrystAndPulseDamageIncrease+19.16666667%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_attri01_hand_03', iconId: 'item_equip_t4_suit_attri01_hand_03' },
  { name: '碾骨小雕像·贰型', set: '碾骨', rarity: 5, type: '配件', sub1: '42+32', sub2: '41+21', special: '32+41.4%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_attri01_edc_02', iconId: 'item_equip_t4_suit_attri01_edc_02' },
  { name: '落潮轻甲', set: '潮涌', rarity: 5, type: '护甲', sub1: '41+87', sub2: '39+58', special: '44+12.32142857%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_burst01_body_01', iconId: 'item_equip_t4_suit_burst01_body_01' },
  { name: '潮涌手甲', set: '潮涌', rarity: 5, type: '护手', sub1: '39+65', sub2: '42+43', special: 'CrystAndPulseDamageIncrease+19.16666667%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_burst01_hand_01', iconId: 'item_equip_t4_suit_burst01_hand_01' },
  { name: '悬河供氧栓', set: '潮涌', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: 'CrystAndPulseDamageIncrease+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_burst01_edc_01', iconId: 'item_equip_t4_suit_burst01_edc_01' },
  { name: '浊流切割炬', set: '潮涌', rarity: 5, type: '配件', sub1: '41+32', sub2: '39+21', special: '17+27.6%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_burst01_edc_02', iconId: 'item_equip_t4_suit_burst01_edc_02' },
  { name: '清波重甲', set: '清波', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: '44+12.32142857%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_body_01', iconId: 'item_equip_t4_suit_combo_cd01_body_01' },
  { name: '清波轻甲', set: '清波', rarity: 5, type: '护甲', sub1: '41+87', sub2: '42+58', special: '87+20.7', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_body_02', iconId: 'item_equip_t4_suit_combo_cd01_body_02' },
  { name: '清波手甲', set: '清波', rarity: 5, type: '护手', sub1: '40+65', sub2: '39+43', special: 'AllSkillDamageIncrease+23%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_hand_01', iconId: 'item_equip_t4_suit_combo_cd01_hand_01' },
  { name: '清波护手', set: '清波', rarity: 5, type: '护手', sub1: '41+65', sub2: '42+43', special: '44+20.53571429%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_hand_02', iconId: 'item_equip_t4_suit_combo_cd01_hand_02' },
  { name: '清波定位仪', set: '清波', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '32+41.4%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_edc_01', iconId: 'item_equip_t4_suit_combo_cd01_edc_01' },
  { name: '清波竹刃', set: '清波', rarity: 5, type: '配件', sub1: '39+32', sub2: '40+21', special: 'FireAndNaturalDamageIncrease+23%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_edc_02', iconId: 'item_equip_t4_suit_combo_cd01_edc_02' },
  { name: '清波水罐', set: '清波', rarity: 5, type: '配件', sub1: '41+32', sub2: '42+21', special: '87+41.4', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_edc_03', iconId: 'item_equip_t4_suit_combo_cd01_edc_03' },
  { name: '清波定位仪·壹型', set: '清波', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '50+23%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_combo_cd01_edc_04', iconId: 'item_equip_t4_suit_combo_cd01_edc_04' },
  { name: 'M.I.警用护甲', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: '87+20.7', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_body_01', iconId: 'item_equip_t4_suit_criti01_body_01' },
  { name: 'M.I.警用罩衣', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '41+87', sub2: '40+58', special: '17+13.8%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_body_02', iconId: 'item_equip_t4_suit_criti01_body_02' },
  { name: 'M.I.警用罩衣·壹型', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '41+87', sub2: '42+58', special: '9+5.175%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_body_03', iconId: 'item_equip_t4_suit_criti01_body_03' },
  { name: 'M.I.警用罩衣·贰型', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '42+87', sub2: '40+58', special: '32+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_body_04', iconId: 'item_equip_t4_suit_criti01_body_04' },
  { name: 'M.I.警用手套', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '40+65', sub2: '39+43', special: '32+34.5%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_hand_01', iconId: 'item_equip_t4_suit_criti01_hand_01' },
  { name: 'M.I.警用手环', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '41+65', sub2: '40+43', special: '17+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_hand_02', iconId: 'item_equip_t4_suit_criti01_hand_02' },
  { name: 'M.I.警用手环·壹型', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '41+65', sub2: '42+43', special: '9+8.625%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_hand_03', iconId: 'item_equip_t4_suit_criti01_hand_03' },
  { name: 'M.I.警用臂环', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: 'CrystAndPulseDamageIncrease+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_edc_01', iconId: 'item_equip_t4_suit_criti01_edc_01' },
  { name: 'M.I.警用瞄具', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '32+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_edc_02', iconId: 'item_equip_t4_suit_criti01_edc_02' },
  { name: 'M.I.警用工具组', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '41+32', sub2: '40+21', special: '9+10.35%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_edc_03', iconId: 'item_equip_t4_suit_criti01_edc_03' },
  { name: 'M.I.警用刺刃', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '42+32', sub2: '41+21', special: 'FireAndNaturalDamageIncrease+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_edc_04', iconId: 'item_equip_t4_suit_criti01_edc_04' },
  { name: 'M.I.警用刺刃·壹型', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '42+32', sub2: '40+21', special: '32+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_criti01_edc_05', iconId: 'item_equip_t4_suit_criti01_edc_05' },
  { name: 'M.I.警用护甲·壹型', set: 'M.I.警用', rarity: 5, type: '护甲', sub1: '40+87', sub2: '41+58', special: '44+12.32142857%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_criti01_body_06', iconId: 'item_equip_t4_suit_criti01_body_06' },
  { name: 'M.I.警用手套·壹型', set: 'M.I.警用', rarity: 5, type: '护手', sub1: '40+65', sub2: '41+43', special: '28+43.125%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_criti01_hand_04', iconId: 'item_equip_t4_suit_criti01_hand_04' },
  { name: 'M.I.警用瞄具·壹型', set: 'M.I.警用', rarity: 5, type: '配件', sub1: '40+32', sub2: '41+21', special: '9+10.35%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_criti01_edc_06', iconId: 'item_equip_t4_suit_criti01_edc_06' },
  { name: '旧锋装甲', set: '旧锋', rarity: 5, type: '护甲', sub1: '39+87', sub2: '42+58', special: '50+11.5%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_crush_fracture_body_01', iconId: 'item_equip_t4_suit_crush_fracture_body_01' },
  { name: '旧锋装甲·壹型', set: '旧锋', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: '87+20.7', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_crush_fracture_body_02', iconId: 'item_equip_t4_suit_crush_fracture_body_02' },
  { name: '旧锋手甲', set: '旧锋', rarity: 5, type: '护手', sub1: '39+65', sub2: '42+43', special: '87+34.5', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_crush_fracture_hand_01', iconId: 'item_equip_t4_suit_crush_fracture_hand_01' },
  { name: '旧锋手甲·壹型', set: '旧锋', rarity: 5, type: '护手', sub1: '40+65', sub2: '39+43', special: '87+34.5', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_crush_fracture_hand_02', iconId: 'item_equip_t4_suit_crush_fracture_hand_02' },
  { name: '旧锋刺刃', set: '旧锋', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: '50+23%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_crush_fracture_edc_01', iconId: 'item_equip_t4_suit_crush_fracture_edc_01' },
  { name: '旧锋刺刃·壹型', set: '旧锋', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '50+23%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_crush_fracture_edc_02', iconId: 'item_equip_t4_suit_crush_fracture_edc_02' },
  { name: '壤流轻甲', set: '壤流', rarity: 5, type: '护甲', sub1: '42+87', sub2: '41+58', special: 'CrystAndPulseDamageIncrease+11.5%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_expend_spell01_body_02', iconId: 'item_equip_t4_suit_expend_spell01_body_02' },
  { name: '壤流护手', set: '壤流', rarity: 5, type: '护手', sub1: '42+65', sub2: '41+43', special: 'CrystAndPulseDamageIncrease+19.16666667%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_expend_spell01_hand_02', iconId: 'item_equip_t4_suit_expend_spell01_hand_02' },
  { name: '壤流短棍', set: '壤流', rarity: 5, type: '配件', sub1: '42+32', sub2: '41+21', special: '32+41.4%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_expend_spell01_edc_02', iconId: 'item_equip_t4_suit_expend_spell01_edc_02' },
  { name: '动火用外骨骼', set: '动火用', rarity: 5, type: '护甲', sub1: '39+87', sub2: '40+58', special: 'FireAndNaturalDamageIncrease+11.5%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_fire_natr01_body_01', iconId: 'item_equip_t4_suit_fire_natr01_body_01' },
  { name: '动火用辅助骨骼', set: '动火用', rarity: 5, type: '护甲', sub1: '41+87', sub2: '42+58', special: 'FireAndNaturalDamageIncrease+11.5%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_fire_natr01_body_02', iconId: 'item_equip_t4_suit_fire_natr01_body_02' },
  { name: '动火用手套', set: '动火用', rarity: 5, type: '护手', sub1: '39+65', sub2: '42+43', special: '87+34.5', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_fire_natr01_hand_01', iconId: 'item_equip_t4_suit_fire_natr01_hand_01' },
  { name: '动火用手甲', set: '动火用', rarity: 5, type: '护手', sub1: '41+65', sub2: '39+43', special: 'FireAndNaturalDamageIncrease+19.16666667%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_fire_natr01_hand_02', iconId: 'item_equip_t4_suit_fire_natr01_hand_02' },
  { name: '动火用手甲·壹型', set: '动火用', rarity: 5, type: '护手', sub1: '42+65', sub2: '41+43', special: 'FireAndNaturalDamageIncrease+19.16666667%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_fire_natr01_hand_03', iconId: 'item_equip_t4_suit_fire_natr01_hand_03' },
  { name: '动火用储能匣', set: '动火用', rarity: 5, type: '配件', sub1: '39+32', sub2: '40+21', special: '87+41.4', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_fire_natr01_edc_01', iconId: 'item_equip_t4_suit_fire_natr01_edc_01' },
  { name: '动火用测温镜', set: '动火用', rarity: 5, type: '配件', sub1: '41+41', sub2: '', special: '32+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_fire_natr01_edc_02', iconId: 'item_equip_t4_suit_fire_natr01_edc_02' },
  { name: '动火用电力匣', set: '动火用', rarity: 5, type: '配件', sub1: '42+32', sub2: '41+21', special: '87+41.4', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_fire_natr01_edc_03', iconId: 'item_equip_t4_suit_fire_natr01_edc_03' },
  { name: '生物辅助重甲', set: '生物辅助', rarity: 5, type: '护甲', sub1: '39+87', sub2: '42+58', special: '29+10.35%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_body_01', iconId: 'item_equip_t4_suit_heal01_body_01' },
  { name: '生物辅助胸甲', set: '生物辅助', rarity: 5, type: '护甲', sub1: '42+87', sub2: '41+58', special: '29+10.35%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_body_02', iconId: 'item_equip_t4_suit_heal01_body_02' },
  { name: '生物辅助臂甲', set: '生物辅助', rarity: 5, type: '护手', sub1: '39+65', sub2: '42+43', special: '44+20.53571429%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_hand_01', iconId: 'item_equip_t4_suit_heal01_hand_01' },
  { name: '生物辅助手甲', set: '生物辅助', rarity: 5, type: '护手', sub1: '42+65', sub2: '39+43', special: '29+17.25%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_hand_02', iconId: 'item_equip_t4_suit_heal01_hand_02' },
  { name: '生物辅助接驳器', set: '生物辅助', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: 'AllDamageTakenScalar+82.85004143%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_edc_01', iconId: 'item_equip_t4_suit_heal01_edc_01' },
  { name: '生物辅助接驳器·贰型', set: '生物辅助', rarity: 5, type: '配件', sub1: '39+41', sub2: '', special: '1+41.4%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_heal01_edc_02', iconId: 'item_equip_t4_suit_heal01_edc_02' },
  { name: '生物辅助护板', set: '生物辅助', rarity: 5, type: '配件', sub1: '42+32', sub2: '41+21', special: 'Main+20.7017835%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_edc_03', iconId: 'item_equip_t4_suit_heal01_edc_03' },
  { name: '生物辅助护盾针', set: '生物辅助', rarity: 5, type: '配件', sub1: '42+41', sub2: '', special: '29+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_edc_04', iconId: 'item_equip_t4_suit_heal01_edc_04' },
  { name: '生物辅助接驳器·壹型', set: '生物辅助', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: '1+41.4%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_heal01_edc_05', iconId: 'item_equip_t4_suit_heal01_edc_01' },
  { name: '纾难印章', set: '独立装备', rarity: 5, type: '配件', sub1: '41+43', sub2: '', special: '44+25.71428571%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_parts_wuling01_edc_03', iconId: 'item_equip_t4_parts_wuling01_edc_03' },
  { name: '纾难手套', set: '独立装备', rarity: 5, type: '护手', sub1: '39+86', sub2: '', special: 'AllSkillDamageIncrease+24%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_parts_wuling01_hand_02', iconId: 'item_equip_t4_parts_wuling01_hand_02' },
  { name: '纾难印章·壹型', set: '独立装备', rarity: 5, type: '配件', sub1: '42+43', sub2: '', special: '9+10.8%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_parts_wuling01_edc_04', iconId: 'item_equip_t4_parts_wuling01_edc_04' },
  { name: '纾难识别牌·壹型', set: '独立装备', rarity: 5, type: '配件', sub1: '40+43', sub2: '', special: '33+43.2%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_parts_wuling01_edc_02', iconId: 'item_equip_t4_parts_wuling01_edc_02' },
  { name: '纾难护手', set: '独立装备', rarity: 5, type: '护手', sub1: '40+86', sub2: '', special: '28+45%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_parts_wuling01_hand_01', iconId: 'item_equip_t4_parts_wuling01_hand_01' },
  { name: '纾难重甲', set: '独立装备', rarity: 5, type: '护甲', sub1: '40+115', sub2: '', special: '17+14.4%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_parts_wuling01_body_01', iconId: 'item_equip_t4_parts_wuling01_body_01' },
  { name: '纾难护甲', set: '独立装备', rarity: 5, type: '护甲', sub1: '41+115', sub2: '', special: '44+12.85714286%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_parts_wuling01_body_02', iconId: 'item_equip_t4_parts_wuling01_body_02' },
  { name: '纾难识别牌', set: '独立装备', rarity: 5, type: '配件', sub1: '39+43', sub2: '', special: 'AllDamageTakenScalar+82.23684211%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_parts_wuling01_edc_01', iconId: 'item_equip_t4_parts_wuling01_edc_01' },
  { name: '点剑轻装甲', set: '点剑', rarity: 5, type: '护甲', sub1: '39+87', sub2: '42+58', special: '44+12.32142857%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_phy01_body_01', iconId: 'item_equip_t4_suit_phy01_body_01' },
  { name: '点剑重装甲', set: '点剑', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: '87+20.7', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_phy01_body_02', iconId: 'item_equip_t4_suit_phy01_body_02' },
  { name: '点剑战术手套', set: '点剑', rarity: 5, type: '护手', sub1: '39+65', sub2: '42+43', special: '50+19.16666667%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_phy01_hand_01', iconId: 'item_equip_t4_suit_phy01_hand_01' },
  { name: '点剑战术手甲', set: '点剑', rarity: 5, type: '护手', sub1: '40+65', sub2: '39+43', special: '28+43.125%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_phy01_hand_02', iconId: 'item_equip_t4_suit_phy01_hand_02' },
  { name: '点剑定位信标', set: '点剑', rarity: 5, type: '配件', sub1: '39+41', sub2: '', special: '87+41.4', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_phy01_edc_01', iconId: 'item_equip_t4_suit_phy01_edc_01' },
  { name: '点剑微型滤芯', set: '点剑', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: '50+23%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_phy01_edc_02', iconId: 'item_equip_t4_suit_phy01_edc_02' },
  { name: '点剑火石', set: '点剑', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '50+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_phy01_edc_03', iconId: 'item_equip_t4_suit_phy01_edc_03' },
  { name: '点剑重装甲·壹型', set: '点剑', rarity: 5, type: '护甲', sub1: '40+87', sub2: '39+58', special: '50+11.5%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_phy01_body_03', iconId: 'item_equip_t4_suit_phy01_body_03' },
  { name: '点剑战术手甲·壹型', set: '点剑', rarity: 5, type: '护手', sub1: '39+65', sub2: '42+43', special: '87+34.5', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_phy01_hand_03', iconId: 'item_equip_t4_suit_phy01_hand_03' },
  { name: '点剑短刃', set: '点剑', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '28+51.75%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_phy01_edc_04', iconId: 'item_equip_t4_suit_phy01_edc_04' },
  { name: '点剑纤维护甲', set: '点剑', rarity: 5, type: '护甲', sub1: '39+87', sub2: '42+58', special: '50+11.5%', material: '赫铜装备原件', voucher: '武陵调度券x25000', equipId: 'item_equip_t4_suit_phy01_body_04', iconId: 'item_equip_t4_suit_phy01_body_04' },
  { name: '轻超域护板', set: '轻超域', rarity: 5, type: '护甲', sub1: '39+87', sub2: '42+58', special: '61+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_poise01_body_01', iconId: 'item_equip_t4_suit_poise01_body_01' },
  { name: '轻超域护手', set: '轻超域', rarity: 5, type: '护手', sub1: '40+65', sub2: '39+43', special: '87+34.5', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_poise01_hand_01', iconId: 'item_equip_t4_suit_poise01_hand_01' },
  { name: '轻超域轻护手', set: '轻超域', rarity: 5, type: '护手', sub1: '42+65', sub2: '40+43', special: 'AllSkillDamageIncrease+23%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_poise01_hand_02', iconId: 'item_equip_t4_suit_poise01_hand_02' },
  { name: '轻超域分析环', set: '轻超域', rarity: 5, type: '配件', sub1: '39+32', sub2: '42+21', special: '50+23%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_poise01_edc_01', iconId: 'item_equip_t4_suit_poise01_edc_01' },
  { name: '轻超域稳定盘', set: '轻超域', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '87+41.4', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_poise01_edc_02', iconId: 'item_equip_t4_suit_poise01_edc_02' },
  { name: '轻超域稳定盘·壹型', set: '轻超域', rarity: 5, type: '配件', sub1: '40+32', sub2: '39+21', special: '50+23%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_poise01_edc_03', iconId: 'item_equip_t4_suit_poise01_edc_03' },
  { name: '轻超域腕表', set: '轻超域', rarity: 5, type: '配件', sub1: '39+32', sub2: '40+21', special: '32+41.4%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_poise01_edc_04', iconId: 'item_equip_t4_suit_poise01_edc_04' },
  { name: '脉冲式干扰服', set: '脉冲式', rarity: 5, type: '护甲', sub1: '41+87', sub2: '42+58', special: '87+20.7', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_pulse_cryst01_body_01', iconId: 'item_equip_t4_suit_pulse_cryst01_body_01' },
  { name: '脉冲式手套', set: '脉冲式', rarity: 5, type: '护手', sub1: '42+65', sub2: '41+43', special: 'CrystAndPulseDamageIncrease+19.16666667%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_pulse_cryst01_hand_01', iconId: 'item_equip_t4_suit_pulse_cryst01_hand_01' },
  { name: '脉冲式探针', set: '脉冲式', rarity: 5, type: '配件', sub1: '41+32', sub2: '40+21', special: '87+41.4', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_pulse_cryst01_edc_01', iconId: 'item_equip_t4_suit_pulse_cryst01_edc_01' },
  { name: '脉冲式校准器', set: '脉冲式', rarity: 5, type: '配件', sub1: '41+41', sub2: '', special: '87+41.4', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_pulse_cryst01_edc_02', iconId: 'item_equip_t4_suit_pulse_cryst01_edc_02' },
  { name: '脉冲式侵入核', set: '脉冲式', rarity: 5, type: '配件', sub1: '42+41', sub2: '', special: '28+51.75%', material: '赤铜装备原件', voucher: '武陵调度券x16000', equipId: 'item_equip_t4_suit_pulse_cryst01_edc_03', iconId: 'item_equip_t4_suit_pulse_cryst01_edc_03' },
  { name: '长息装甲', set: '长息', rarity: 5, type: '护甲', sub1: '42+87', sub2: '41+58', special: '87+20.7', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_usp02_body_01', iconId: 'item_equip_t4_suit_usp02_body_01' },
  { name: '长息护手', set: '长息', rarity: 5, type: '护手', sub1: '41+65', sub2: '39+43', special: '44+20.53571429%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_usp02_hand_01', iconId: 'item_equip_t4_suit_usp02_hand_01' },
  { name: '长息护手·壹型', set: '长息', rarity: 5, type: '护手', sub1: '41+65', sub2: '42+43', special: '44+20.53571429%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_usp02_hand_02', iconId: 'item_equip_t4_suit_usp02_hand_01' },
  { name: '长息蓄电核', set: '长息', rarity: 5, type: '配件', sub1: '41+32', sub2: '39+21', special: '44+24.64285714%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_usp02_edc_01', iconId: 'item_equip_t4_suit_usp02_edc_01' },
  { name: '长息蓄电核·壹型', set: '长息', rarity: 5, type: '配件', sub1: '41+32', sub2: '42+21', special: '29+20.7%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_usp02_edc_02', iconId: 'item_equip_t4_suit_usp02_edc_02' },
  { name: '长息辅助臂', set: '长息', rarity: 5, type: '配件', sub1: '42+32', sub2: '41+21', special: '44+24.64285714%', material: '息壤装备原件', voucher: '武陵调度券x8000', equipId: 'item_equip_t4_suit_usp02_edc_03', iconId: 'item_equip_t4_suit_usp02_edc_03' }
];

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
    return {
      key: normalized,
      value: 0,
      unit: '',
      display: normalized,
    }
  }

  const stat = String(match[1] || '').replace(/\+$/g, '').trim()
  const value = Number(match[2])
  const unit = match[3] || ''

  return {
    key: stat || normalized,
    value: Number.isFinite(value) ? value : 0,
    unit,
    display: normalized,
  }
}


// ─── Build equips ──────────────────────────────────────────────────────────


/** Parse voucher string "名称x数量" into EquipVoucher */
function parseVoucher(raw: string): EquipVoucher | null {
  const text = String(raw || '').trim()
  if (!text) return null
  const match = text.match(/^(.+?)x(\d+)$/)
  if (!match) return null
  return { name: match[1], count: Number(match[2]) }
}

function buildEquips(): Equip[] {
  const seen = new Set<string>()
  const result: Equip[] = []

  for (const raw of RAW_EQUIPS) {
    const imageId = raw.iconId || raw.equipId

    const primaryId = raw.equipId || imageId
    let uniqueId = primaryId
    let counter = 1
    while (seen.has(uniqueId)) {
      uniqueId = primaryId + '-' + counter
      counter++
    }
    seen.add(uniqueId)

    const sub1 = parseAttr(raw.sub1)
    const sub2 = parseAttr(raw.sub2)
    const special = parseAttr(raw.special)
    const voucher = parseVoucher(raw.voucher)

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
      voucher,
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
      .map((e) => e.sub1?.key)
      .filter((s): s is string => !!s),
  ),
].sort()


/** All unique sub2 stat names (for filter) */
export const sub2StatOptions: string[] = [
  ...new Set(
    equips
      .map((e) => e.sub2?.key)
      .filter((s): s is string => !!s),
  ),
].sort()


/** All unique special stat names (for filter) */
export const specialStatOptions: string[] = [
  ...new Set(
    equips
      .map((e) => e.special?.key)
      .filter((s): s is string => !!s),
  ),
].sort()
