import { describe, expect, it } from 'vitest'
import { parseChangelog, parseForceUpgradeSerial } from './generate-version.mjs'

const FIELD = '\x1f'
const RECORD = '\x1e'

describe('parseChangelog', () => {
  it('adds normalized release tags and preserves forced release history', () => {
    const raw = [
      `aaa11111${FIELD}2026-07-20T00:00:00Z${FIELD}tag: v1.4.0${FIELD}Regular release${RECORD}`,
      `bbb22222${FIELD}2026-07-19T00:00:00Z${FIELD}tag: force-2, tag: v1.3.1${FIELD}Forced by marker${RECORD}`,
      `ccc33333${FIELD}2026-07-18T00:00:00Z${FIELD}tag: v1.2.4-force, tag: force-1${FIELD}Forced by suffix${RECORD}`,
      `ddd44444${FIELD}2026-07-17T00:00:00Z${FIELD}HEAD -> main${FIELD}Untagged commit\n\nCo-authored-by: Example <example@example.com>${RECORD}`,
    ].join('\n')

    expect(parseChangelog(raw)).toEqual([
      {
        commit: 'aaa11111',
        commitTime: '2026-07-20T00:00:00Z',
        message: 'Regular release',
        version: 'v1.4.0',
        forceUpdate: false,
      },
      {
        commit: 'bbb22222',
        commitTime: '2026-07-19T00:00:00Z',
        message: 'Forced by marker',
        version: 'v1.3.1',
        forceUpdate: true,
      },
      {
        commit: 'ccc33333',
        commitTime: '2026-07-18T00:00:00Z',
        message: 'Forced by suffix',
        version: 'v1.2.4',
        forceUpdate: true,
      },
      {
        commit: 'ddd44444',
        commitTime: '2026-07-17T00:00:00Z',
        message: 'Untagged commit\n\nCo-authored-by: Example',
        forceUpdate: false,
      },
    ])
  })
})

describe('parseForceUpgradeSerial', () => {
  it('uses the highest retained force marker', () => {
    expect(parseForceUpgradeSerial('force-1\nforce-12\nforce-invalid\nforce-2')).toBe(12)
  })

  it('returns zero when no force marker exists', () => {
    expect(parseForceUpgradeSerial('v1.4.0\nmain')).toBe(0)
  })
})
