import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { APP_INIT_DONE_SCRIPT } from '@/lib/app-init-done-script'
import { APP_INIT_STORAGE_KEY } from '@/lib/constants'

/**
 * The repeat-visit curtain skip depends on this script agreeing with
 * useAppInitStore's persist envelope. If the key or the shape drifts, the
 * failure is silent in both directions: the attribute is simply never set, and
 * users see the curtain painted and then removed on every reload — the exact
 * regression the script exists to prevent.
 */

type Options = { stored?: unknown; storedRaw?: string | null; throws?: boolean }

function run(options: Options = {}) {
  const attributes: Record<string, string> = {}
  const sandbox = {
    sessionStorage: {
      getItem(key: string) {
        if (key !== APP_INIT_STORAGE_KEY) return null
        if (options.throws) throw new Error('storage blocked')
        if (options.storedRaw !== undefined) return options.storedRaw
        if (options.stored === undefined) return null
        return JSON.stringify(options.stored)
      },
    },
    document: {
      documentElement: {
        setAttribute(name: string, value: string) { attributes[name] = value },
      },
    },
  }
  vm.runInNewContext(APP_INIT_DONE_SCRIPT, sandbox)
  return attributes['data-cep-init-done']
}

describe('APP_INIT_DONE_SCRIPT', () => {
  it('embeds the shared storage key, not a literal', () => {
    expect(APP_INIT_DONE_SCRIPT).toContain(JSON.stringify(APP_INIT_STORAGE_KEY))
  })

  it('never contains </script> (it is inlined via dangerouslySetInnerHTML)', () => {
    expect(APP_INIT_DONE_SCRIPT).not.toContain('</script>')
  })

  it('marks <html> when zustand/persist reports a completed init', () => {
    expect(run({ stored: { state: { hasCompleted: true }, version: 0 } })).toBe('1')
  })

  it('does nothing when the persisted flag is false', () => {
    expect(run({ stored: { state: { hasCompleted: false }, version: 0 } })).toBeUndefined()
  })

  it('does nothing when nothing is persisted', () => {
    expect(run({ stored: undefined })).toBeUndefined()
  })

  it('does nothing when the envelope has no state (shape drift fails safe)', () => {
    expect(run({ stored: { hasCompleted: true } })).toBeUndefined()
  })

  it('does nothing when hasCompleted is not strictly true', () => {
    expect(run({ stored: { state: { hasCompleted: 'yes' } } })).toBeUndefined()
  })

  it('never throws on a corrupt envelope', () => {
    expect(() => run({ storedRaw: '{not json' })).not.toThrow()
    expect(run({ storedRaw: '{not json' })).toBeUndefined()
  })

  it('never throws when sessionStorage is blocked', () => {
    expect(() => run({ throws: true })).not.toThrow()
    expect(run({ throws: true })).toBeUndefined()
  })
})
