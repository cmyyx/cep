/**
 * Import-failure feedback helpers.
 *
 * When a MaaEND 基质库存 cannot be imported, the user is the only one who has the
 * file. These builders turn that dead end into a reportable bug: a copyable
 * diagnostic block plus a prefilled GitHub issue, so the maintainer gets the
 * protocol versions and the failing path without a round of questions.
 *
 * Deliberately free of React/i18n: the text is data for a maintainer, and the
 * dialog supplies its own localized button labels.
 */

import type { MaaEndParseFailure } from './maamend'

/** Where the report button points. Kept here so tests and UI cannot drift apart. */
export const MAAEND_ISSUES_NEW_URL = 'https://github.com/cmyyx/cep/issues/new'

export interface MaaEndImportReportInput {
  fileName: string
  /** Absolute page URL, so the maintainer can reproduce on the same route. */
  pageUrl: string
  userAgent: string
  /** Protocol version this site implements. */
  supportedVersion: number
  /** Date the baseline was taken (see protocol.ts). */
  adaptedAt: string
  failure: MaaEndParseFailure
}

export interface MaaEndImportReport {
  title: string
  body: string
}

/** Machine-readable reason, stable enough to grep in the issue tracker. */
function failureCode(failure: MaaEndParseFailure): string {
  return failure.reason
}

function fileVersionLine(failure: MaaEndParseFailure): string {
  if (failure.reason === 'unsupported_version') return `v${failure.version}`
  return '未知（文件未通过解析）'
}

/**
 * Build the diagnostic block copied to the clipboard and pasted into an issue.
 *
 * Field labels stay Chinese: the maintainer reads them, and the block is meant
 * to survive translation of the surrounding UI.
 */
export function buildMaaEndImportReport(input: MaaEndImportReportInput): MaaEndImportReport {
  const { failure } = input
  const code = failureCode(failure)
  const path = failure.reason === 'invalid' && failure.issuePath ? failure.issuePath : '无'

  const title =
    failure.reason === 'unsupported_version'
      ? `[MaaEND Import] ${code}: 文件 v${failure.version} > 本站 v${input.supportedVersion}`
      : `[MaaEND Import] ${code}${failure.reason === 'invalid' && failure.issuePath ? `: ${failure.issuePath}` : ''}`

  const body = [
    '### MaaEND 基质库存导入失败',
    `- 原因: \`${code}\``,
    `- 文件协议版本: ${fileVersionLine(failure)}`,
    `- 本站适配版本: v${input.supportedVersion}（${input.adaptedAt}）`,
    `- 结构诊断: \`${path}\``,
    `- 文件名: \`${input.fileName}\``,
    `- 页面: ${input.pageUrl || '未知'}`,
    `- 用户代理: \`${input.userAgent || '未知'}\``,
    '',
    '请附上截图（及可复现的步骤）；如果方便，把导出的文件也一起附上。',
  ].join('\n')

  return { title, body }
}

/** Prefilled `issues/new` URL for a report. */
export function buildMaaEndIssueUrl(report: MaaEndImportReport): string {
  const params = new URLSearchParams({ title: report.title, body: report.body })
  return `${MAAEND_ISSUES_NEW_URL}?${params.toString()}`
}
