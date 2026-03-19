import { create } from "zustand";

interface DisputeStore {
  showDisputeModal: boolean;
  needsCheck: boolean;
  setShowDisputeModal: (show: boolean) => void;
  setNeedsCheck: (needs: boolean) => void;
}

export const useDisputeStore = create<DisputeStore>((set) => ({
  showDisputeModal: false,
  needsCheck: true, // Initial check on mount
  setShowDisputeModal: (show) => set({ showDisputeModal: show }),
  setNeedsCheck: (needs) => set({ needsCheck: needs }),
}));
