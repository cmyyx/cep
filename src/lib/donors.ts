export interface Donor {
  name: string
  amount: number
  date?: string
  message?: string
}

/**
 * 赞赏名单 —— 手动维护，按金额从高到低排列。
 * 组件内渲染时亦按 amount 降序排序，新增条目直接追加到数组末尾即可。
 */
export const donors: Donor[] = [
  // 示例格式（请替换为真实数据）：
  // { name: '昵称', amount: 66.66, date: '2026-07', message: '加油！' },
]
