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

    expect(report.title).toContain('unsupported_version')
    expect(report.title).toContain('v2')
    expect(report.body).toContain('文件协议版本: v2')
    expect(report.body).toContain('本站适配版本: v1（2026-11-22）')
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
    expect(report.body).toContain('结构诊断: `items[3].skills`')
    // The file version is unknown in this case, and must not be invented
    expect(report.body).toContain('文件协议版本: 未知')
  })

  it('copes with a payload that failed before any path was known', () => {
    const report = buildMaaEndImportReport({ ...base, failure: { reason: 'invalid', issuePath: null } })

    expect(report.title).toContain('invalid')
    expect(report.body).toContain('结构诊断: `无`')
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
