// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalFileDropOverlay } from './global-file-drop-overlay'
import { useDataImportStore } from '@/stores/useDataImportStore'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

/** jsdom has no DataTransfer — hand the handler the fields it actually reads. */
function dragEvent(type: string, files: File[] = []): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: files.length > 0 ? ['Files'] : [], files, dropEffect: 'none' },
  })
  return event
}

function jsonFile(name = 'a.json'): File {
  return new File(['[]'], name, { type: 'application/json' })
}

beforeEach(() => {
  useDataImportStore.setState({ request: null, errorKey: null, success: false })
})

afterEach(() => {
  cleanup()
})

describe('GlobalFileDropOverlay', () => {
  it('shows the hint while a file is dragged over the page and hides it again', () => {
    render(<GlobalFileDropOverlay />)
    expect(screen.queryByText('settings.importDropTitle')).toBeNull()

    act(() => {
      window.dispatchEvent(dragEvent('dragenter', [jsonFile()]))
    })
    expect(screen.getByText('settings.importDropTitle')).not.toBeNull()

    act(() => {
      window.dispatchEvent(dragEvent('dragleave'))
    })
    expect(screen.queryByText('settings.importDropTitle')).toBeNull()
  })

  it('ignores non-file drags', () => {
    render(<GlobalFileDropOverlay />)

    act(() => {
      window.dispatchEvent(dragEvent('dragenter'))
    })

    expect(screen.queryByText('settings.importDropTitle')).toBeNull()
  })

  it('opens the import dialog for a dropped .json file', async () => {
    render(<GlobalFileDropOverlay />)
    const event = dragEvent('drop', [jsonFile('essence_inventory.json')])

    act(() => {
      window.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => {
      expect(useDataImportStore.getState().request?.fileName).toBe('essence_inventory.json')
    })
  })

  it('reports an unsupported file type without reading it', async () => {
    render(<GlobalFileDropOverlay />)

    act(() => {
      window.dispatchEvent(dragEvent('drop', [new File(['x'], 'screenshot.png', { type: 'image/png' })]))
    })

    await waitFor(() => {
      expect(useDataImportStore.getState().errorKey).toBe('settings.importUnsupportedFile')
    })
    expect(useDataImportStore.getState().request).toBeNull()
  })

  it('leaves drops inside text editors to the editor', () => {
    render(<GlobalFileDropOverlay />)
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    const event = dragEvent('drop', [jsonFile()])
    act(() => {
      textarea.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(false)
    expect(useDataImportStore.getState().request).toBeNull()
    textarea.remove()
  })
})
