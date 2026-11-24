/**
 * Import-failure feedback helpers.
 *
 * When a MaaEND 基质库存 cannot be imported, the user is the only one who has the
 * file. These builders turn that dead end into a reportable bug: a copyable
 * diagnostic block plus a prefilled GitHub issue, so the maintainer gets the
 * protocol versions and the failing path without a round of questions.
 *
 * Field labels are English on purpose: the block is maintainer-facing data
 * pasted into a public issue, and it mirrors the existing missing-i18n report in
 * `sync-notifier.tsx`. The dialog keeps every user-facing instruction localized.
 *
 * Deliberately free of React/i18n for that reason.
 */

import type { MaaEndParseFailure } from './maamend'

/** Where the report button points. Kept here so tests and UI cannot drift apart. */
export const MAAEND_ISSUES_NEW_URL = 'https://github.com/cmyyx/cep/issues/new'

export interface MaaEndImportReportInput {
  fileName: string
  /** Page origin + pathname (never the query/fragment: it can hold user data). */
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

/**
 * Collapse untrusted text into one line: file names and coverage keys come from
 * the imported file, so they must not break out of the `- label:` line or forge
 * extra report sections.
 */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/** Render an untrusted value as a single inline-code span. */
function inlineCode(value: string): string {
  const collapsed = oneLine(value)
  // Backticks would end the code span; line breaks are already gone above.
  return collapsed.includes('`') ? collapsed.replace(/`/g, "'") : collapsed
}

function fileVersionLabel(failure: MaaEndParseFailure): string {
  if (failure.reason === 'unsupported_version') return `v${failure.version}`
  return 'unknown (file did not parse)'
}

/**
 * Build the diagnostic block copied to the clipboard and pasted into an issue.
 */
export function buildMaaEndImportReport(input: MaaEndImportReportInput): MaaEndImportReport {
  const { failure } = input
  const code = failure.reason
  const issuePath = failure.reason === 'invalid' && failure.issuePath ? failure.issuePath : ''
  const titlePath = issuePath ? `: ${oneLine(issuePath)}` : ''

  const title =
    failure.reason === 'unsupported_version'
      ? `[MaaEND Import] ${code}: file v${failure.version} > site v${input.supportedVersion}`
      : `[MaaEND Import] ${code}${titlePath}`

  const body = [
    '### MaaEND essence inventory import failed',
    '',
    `- reason: \`${code}\``,
    `- file protocol version: ${fileVersionLabel(failure)}`,
    `- site protocol version: v${input.supportedVersion} (${inlineCode(input.adaptedAt)})`,
    `- failing field: \`${issuePath ? inlineCode(issuePath) : 'none'}\``,
    `- file name: \`${inlineCode(input.fileName)}\``,
    `- page: ${input.pageUrl ? inlineCode(input.pageUrl) : 'unknown'}`,
    `- user agent: \`${inlineCode(input.userAgent || 'unknown')}\``,
  ].join('\n')

  return { title, body }
}

/** Prefilled `issues/new` URL for a report. */
export function buildMaaEndIssueUrl(report: MaaEndImportReport): string {
  const params = new URLSearchParams({ title: oneLine(report.title), body: report.body })
  return `${MAAEND_ISSUES_NEW_URL}?${params.toString()}`
}
