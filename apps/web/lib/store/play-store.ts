import { create } from "zustand";

type PlayState = {
  selectedParcelId: string | null;
  setSelectedParcelId: (id: string | null) => void;
};

export const usePlayStore = create<PlayState>((set) => ({
  selectedParcelId: null,
  setSelectedParcelId: (id) => set({ selectedParcelId: id }),
}));
