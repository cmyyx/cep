import type { WikiLocale } from '@/types/wiki'

/** 紧急公告等级 —— 决定横幅的视觉分档。 */
export type BootstrapNoticeLevel = 'info' | 'warning' | 'critical'

/** 运营服务下发的四语言文案。任意语言都可能缺失, 消费侧需按回退链取值。 */
export type BootstrapLocalizedText = Partial<Record<WikiLocale, string>>

/**
 * 单条紧急公告 (同一时刻最多一条, 由后端按 "最新 + 置顶优先" 选出)。
 * 横幅不可关闭: 承载的是必须送达的维护/故障信息, 下线由运营在管理端停用。
 */
export interface BootstrapNotice {
  id: number
  level: BootstrapNoticeLevel
  title: BootstrapLocalizedText
  body: BootstrapLocalizedText
  /** 已通过 sanitizeNoticeUrl 校验的 http(s) 或站内绝对路径; 非法链接被丢弃。 */
  linkUrl?: string
  linkLabel: BootstrapLocalizedText
  updatedAt?: string
  /**
   * 定向语言 (前向兼容: 后端计划下发 `locales?: string[] | null`)。
   * 非空数组时只对列表内的 locale 展示; 字段缺失 / 空数组 = 不限语言。
   * 刻意不收窄为 WikiLocale —— 未知取值必须保持"不命中"而不是被丢成"不限语言"。
   */
  locales?: readonly string[]
}

/** 运营公告接口返回的载荷，供页面初始化和运行期间的公告同步使用。 */
export interface BootstrapPayload {
  notice: BootstrapNotice | null
  /** RFC3339 服务器时间; 字段缺失或类型不对时为 undefined。 */
  serverTime?: string
}
