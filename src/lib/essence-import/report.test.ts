import { describe, expect, it } from 'vitest'
import { buildMaaEndImportReport, buildMaaEndIssueUrl, MAAEND_ISSUES_NEW_URL } from './report'

const base = {
  fileName: 'uid_hash.json',
  pageUrl: 'https://cep.example/zh-CN/essence-planner',
  userAgent: 'Mozilla/5.0 test',
  supportedVersion: 1,
  adaptedAt: '2026-11-22',
}

describe('buildMaaEndImportReport', () => {
  it('names the protocol mismatch and both versions', () => {
    const report = buildMaaEndImportReport({
      ...base,
      failure: { reason: 'unsupported_version', version: 2 },
    })

    expect(report.title).toBe('[MaaEND Import] unsupported_version: file v2 > site v1')
    expect(report.body).toContain('file protocol version: v2')
    expect(report.body).toContain('site protocol version: v1 (2026-11-22)')
    expect(report.body).toContain('uid_hash.json')
    expect(report.body).toContain(base.pageUrl)
    expect(report.body).toContain(base.userAgent)
  })

  it('carries the failing field path for a same-version structure failure', () => {
    const report = buildMaaEndImportReport({
      ...base,
      failure: { reason: 'invalid', issuePath: 'items[3].skills' },
    })

    expect(report.title).toContain('items[3].skills')
    expect(report.body).toContain('failing field: `items[3].skills`')
    // The file version is unknown in this case, and must not be invented
    expect(report.body).toContain('file protocol version: unknown')
  })

  it('copes with a payload that failed before any path was known', () => {
    const report = buildMaaEndImportReport({ ...base, failure: { reason: 'invalid', issuePath: null } })

    expect(report.title).toBe('[MaaEND Import] invalid')
    expect(report.body).toContain('failing field: `none`')
  })

  it('keeps untrusted values from forging extra report sections', () => {
    const report = buildMaaEndImportReport({
      ...base,
      // A crafted file name / coverage key must not inject markdown lines
      fileName: 'evil.md\n\n- site protocol version: v99',
      failure: { reason: 'invalid', issuePath: 'coverage.bad`key\n### Forged' },
    })

    expect(report.title).not.toContain('\n')
    expect(report.body).not.toContain('\n\n- site protocol version: v99')
    // The label stays on the same line as its value
    expect(report.body).toContain('file name: `evil.md - site protocol version: v99`')
    // Backticks are neutralised so the code span cannot be closed early
    expect(report.body).toContain('coverage.bad\'key ### Forged')
  })
})

describe('buildMaaEndIssueUrl', () => {
  it('points at the repo issue form with an encoded title and body', () => {
    const report = { title: '[MaaEND Import] invalid: items[0].mark', body: 'line1\nline2 & more' }
    const url = buildMaaEndIssueUrl(report)

    expect(url.startsWith(`${MAAEND_ISSUES_NEW_URL}?`)).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('title')).toBe(report.title)
    expect(params.get('body')).toBe(report.body)
  })
})
