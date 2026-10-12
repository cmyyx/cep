import { beforeEach, describe, expect, it } from 'vitest'
import { useDataImportStore } from './useDataImportStore'
import type { PreparedImport } from '@/lib/data-import'

function prepared(kind: PreparedImport['kind']): PreparedImport {
  return { kind, file: null, inventory: null }
}

beforeEach(() => {
  useDataImportStore.setState({ request: null, errorKey: null, success: false })
})

describe('useDataImportStore', () => {
  it('opens a request and bumps a fresh id per file', () => {
    useDataImportStore.getState().requestImport('a.json', prepared('cep-backup'))
    const first = useDataImportStore.getState().request

    useDataImportStore.getState().requestImport('b.json', prepared('maamend-essence'))

    const second = useDataImportStore.getState().request
    expect(first?.fileName).toBe('a.json')
    expect(second?.fileName).toBe('b.json')
    expect(second?.prepared.kind).toBe('maamend-essence')
    expect(second!.id).toBeGreaterThan(first!.id)
  })

  it('clears a pending error when a new file arrives', () => {
    useDataImportStore.getState().reportError('settings.importInvalidFormat')
    useDataImportStore.getState().requestImport('a.json', prepared(null))

    expect(useDataImportStore.getState().errorKey).toBeNull()
  })

  it('closes the request without touching the success toast', () => {
    useDataImportStore.getState().requestImport('a.json', prepared(null))
    useDataImportStore.getState().markSuccess()
    useDataImportStore.getState().close()

    expect(useDataImportStore.getState().request).toBeNull()
    expect(useDataImportStore.getState().success).toBe(true)
  })

  it('dismisses the success toast', () => {
    useDataImportStore.getState().markSuccess()
    useDataImportStore.getState().dismissSuccess()
    expect(useDataImportStore.getState().success).toBe(false)
  })
})
