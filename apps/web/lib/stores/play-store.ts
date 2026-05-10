import { create } from "zustand";

export type PlayStore = {
  selectedParcelId: string | null;
  selectParcel: (parcelId: string) => void;
};

export const usePlayStore = create<PlayStore>((set) => ({
  selectedParcelId: null,
  selectParcel: (parcelId) => set({ selectedParcelId: parcelId }),
}));
