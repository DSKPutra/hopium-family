import { create } from 'zustand';

/** Ephemeral UI state shared across routes (not persisted). */
interface UiState {
  /** Asset currently open on screen (for keyboard shortcuts b / s). */
  focusedAssetId: string | null;
  locked: boolean;
  setFocusedAsset: (id: string | null) => void;
  setLocked: (locked: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  focusedAssetId: null,
  locked: false,
  setFocusedAsset: (id) => set({ focusedAssetId: id }),
  setLocked: (locked) => set({ locked }),
}));
