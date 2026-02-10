import { create } from "zustand";

export const useScanStore = create((set) => ({
  // Scan history
  scans: [],
  addScan: (scan) => set((state) => ({ scans: [scan, ...state.scans] })),
  clearHistory: () => set({ scans: [] }),

  // Settings
  settings: {
    autoScanEnabled: true,
    hapticsEnabled: true,
    voiceEnabled: true,
  },
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  // Current scan result
  currentScan: null,
  setCurrentScan: (scan) => set({ currentScan: scan }),
}));
