import { create } from 'zustand'

interface UIStore {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  settingsOpen: boolean
  uploadModalOpen: boolean
  
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  toggleSettings: () => void
  toggleUploadModal: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  settingsOpen: false,
  uploadModalOpen: false,
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  toggleUploadModal: () => set((state) => ({ uploadModalOpen: !state.uploadModalOpen })),
}))
