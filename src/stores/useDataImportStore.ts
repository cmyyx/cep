import { create } from 'zustand'
import type { PreparedImport } from '@/lib/data-import'

/**
 * Parsed import file waiting for the user to confirm.
 *
 * Not persisted: a file payload is a one-shot request, and keeping it in
 * localStorage would both leak the file contents and reopen the dialog on
 * every reload.
 */
export interface DataImportRequest {
  /** Monotonic id — remounts the dialog body so selections reset per file. */
  id: number
  fileName: string
  /** Detected format + parsed payload (see prepareImport). */
  prepared: PreparedImport
}

interface DataImportState {
  request: DataImportRequest | null
  /** i18n key of a transient error toast (read / parse / format failure). */
  errorKey: string | null
  /** Show the success toast after an import finished. */
  success: boolean
  requestImport: (fileName: string, prepared: PreparedImport) => void
  reportError: (errorKey: string) => void
  clearError: () => void
  markSuccess: () => void
  dismissSuccess: () => void
  close: () => void
}

let requestSeq = 0

export const useDataImportStore = create<DataImportState>((set) => ({
  request: null,
  errorKey: null,
  success: false,
  requestImport: (fileName, prepared) => {
    requestSeq += 1
    set({ request: { id: requestSeq, fileName, prepared }, errorKey: null })
  },
  reportError: (errorKey) => set({ errorKey }),
  clearError: () => set({ errorKey: null }),
  markSuccess: () => set({ success: true }),
  dismissSuccess: () => set({ success: false }),
  close: () => set({ request: null }),
}))
