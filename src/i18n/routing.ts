import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['zh-CN', 'zh-TW', 'ja', 'en'],
  defaultLocale: 'zh-CN',
})
