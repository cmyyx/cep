// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataImporter } from './data-importer'
import { useDataImportStore } from '@/stores/useDataImportStore'
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

beforeEach(() => {
  useDataImportStore.setState({ request: null, errorKey: null, success: false })
})

afterEach(() => {
  cleanup()
})

describe('DataImporter', () => {
  it('hands a picked file to the import dialog store', async () => {
    render(<DataImporter />)
    const input = screen.getByLabelText('settings.importData') as HTMLInputElement
    const file = new File([JSON.stringify({ version: 2, modules: {} })], 'cep-data-export.json', {
      type: 'application/json',
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(useDataImportStore.getState().request?.fileName).toBe('cep-data-export.json')
    })
    const prepared = useDataImportStore.getState().request?.prepared
    expect(prepared?.kind).toBe('cep-backup')
    expect(prepared?.file?.version).toBe(2)
    expect(prepared?.inventory).toBeNull()
  })

  it('reports broken JSON through the store toast', async () => {
    render(<DataImporter />)
    const input = screen.getByLabelText('settings.importData') as HTMLInputElement

    fireEvent.change(input, { target: { files: [new File(['{oops'], 'broken.json', { type: 'application/json' })] } })

    await waitFor(() => {
      expect(useDataImportStore.getState().errorKey).toBe('settings.importParseError')
    })
    expect(useDataImportStore.getState().request).toBeNull()
  })
})
