import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('i18n key checker', () => {
  it('does not resolve generic template variables from unrelated files', () => {
    const result = spawnSync(process.execPath, ['scripts/check-i18n.mjs', '--quiet'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    expect(result.stdout).not.toContain('weaponStats.1045523485')
    expect(result.stdout).not.toContain('weaponStats.admin@canmoe.com')
    expect(result.status).toBe(0)
  })
})
