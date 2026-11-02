import { create } from 'zustand'
import type { AdworkUnavailableReason } from '@/lib/adwork'
import type { AdSlotName } from '@/types/ad'

export type AdworkPhase = 'idle' | 'pending' | 'loaded' | 'unavailable' | 'failed'

interface AdworkState {
  /** Per-slot fill state. `loaded` means the SDK injected a creative. */
  phases: Record<AdSlotName, AdworkPhase>
  /**
   * Why a successful `/imp` response carried no creative. Only meaningful while
   * the slot is `unavailable`; every other phase clears it so a stale reason
   * can never leak into the next status message.
   */
  unavailableReasons: Record<AdSlotName, AdworkUnavailableReason | null>
  /**
   * Closed slots. Deliberately NOT persisted: a refresh must bring the ad back,
   * so this only lasts for the lifetime of the page. It does survive client
   * side navigation, which is what the close button is for.
   */
  dismissed: Record<AdSlotName, boolean>
  /**
   * The slot currently mounted. The SDK's error callback carries no element, so
   * it is the only way to attribute an error; exactly one slot is mounted at a
   * time because the SDK aborts the whole page when a phone sees a 300x250
   * container.
   */
  activeSlot: AdSlotName | null
  activate: (slot: AdSlotName) => void
  setPhase: (slot: AdSlotName, phase: AdworkPhase) => void
  setUnavailable: (slot: AdSlotName, reason: AdworkUnavailableReason) => void
  dismiss: (slot: AdSlotName) => void
}

export const useAdworkStore = create<AdworkState>((set) => ({
  phases: { desktop: 'idle', mobile: 'idle' },
  unavailableReasons: { desktop: null, mobile: null },
  dismissed: { desktop: false, mobile: false },
  activeSlot: null,
  activate: (slot) => set({ activeSlot: slot }),
  setPhase: (slot, phase) =>
    set((state) => ({
      phases: { ...state.phases, [slot]: phase },
      unavailableReasons: { ...state.unavailableReasons, [slot]: null },
    })),
  setUnavailable: (slot, reason) =>
    set((state) => ({
      phases: { ...state.phases, [slot]: 'unavailable' },
      unavailableReasons: { ...state.unavailableReasons, [slot]: reason },
    })),
  dismiss: (slot) => set((state) => ({ dismissed: { ...state.dismissed, [slot]: true } })),
}))

/** Test helper — reset the session state. */
export function resetAdworkStoreForTests(): void {
  useAdworkStore.setState({
    phases: { desktop: 'idle', mobile: 'idle' },
    unavailableReasons: { desktop: null, mobile: null },
    dismissed: { desktop: false, mobile: false },
    activeSlot: null,
  })
}
