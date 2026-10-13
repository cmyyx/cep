import { create } from 'zustand'

interface ToastUiState {
  /**
   * 右下角通知堆里是否有任何一条通知在场（含淡出阶段）。
   * 供 UpdateChangelogNotice 等右下角浮层动态避让，避免与通知重叠。
   */
  syncToastVisible: boolean
  setSyncToastVisible: (visible: boolean) => void
}

export const useToastUiStore = create<ToastUiState>((set) => ({
  syncToastVisible: false,
  setSyncToastVisible: (visible) => set({ syncToastVisible: visible }),
}))
