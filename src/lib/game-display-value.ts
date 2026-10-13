/**
 * 游戏显示口径 —— 面板数字的取整规则。
 *
 * 游戏内数值本身是浮点 (`AttributesData.m_attrs` 是 `double[]`, `Attributes.GetValue()`
 * 返回 `double`), 取整只发生在 UI 层。规则见
 * `AKEData/LuaScripts/Common/Utils/AttributeUtils.lua`:
 *
 *   generateShowValueByValueFormat (:294)  面板/装备数值走这条
 *     attrValue = lume.round(attrValue * 100000) / 100000   -- 先按 1e-5 四舍五入
 *     if not isPercent then attrValue = math.floor(attrValue) end  -- 非百分比再向下取整
 *
 *   lume.round (:98)  x >= 0 → floor(x + .5), 否则 ceil(x - .5)
 *
 * 「先按 1e-5 四舍五入」这一步不能省: 它专门用来消掉浮点尾巴, 否则
 * 25327.999999999 会被 floor 成 25327, 而游戏显示 25328。
 */

const DISPLAY_PRECISION = 100000

/** lume.round 的等价实现: 四舍五入, 半数远离零。 */
function roundHalfAwayFromZero(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5)
}

/**
 * 非百分比属性 (生命值/攻击力/防御力/力量/敏捷/智识/意志) 在游戏里的显示值。
 * 计算值本身不要过这个函数 —— 它只用于渲染, 派生公式必须用全精度值。
 */
export function gameDisplayValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.floor(roundHalfAwayFromZero(value * DISPLAY_PRECISION) / DISPLAY_PRECISION)
}
