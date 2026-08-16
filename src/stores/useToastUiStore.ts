import { create } from 'zustand'

interface ToastUiState {
  /**
   * 右下角 sync toast 是否正在显示（含淡出阶段）。
   * 供 UpdateChangelogNotice 等右下角浮层动态避让，避免与 toast 重叠。
   */
  syncToastVisible: boolean
  setSyncToastVisible: (visible: boolean) => void
}

export const useToastUiStore = create<ToastUiState>((set) => ({
  syncToastVisible: false,
  setSyncToastVisible: (visible) => set({ syncToastVisible: visible }),
}))
