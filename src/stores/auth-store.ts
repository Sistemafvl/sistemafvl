import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionType = "user" | "manager";

interface UnitSession {
  id: string;
  name: string;
  domain_id: string;
  domain_name: string;
  user_profile_id: string;
  user_name: string;
  user_cpf: string;
  sessionType: SessionType;
}

interface AuthState {
  // Master admin
  isMasterAdmin: boolean;
  setMasterAdmin: (value: boolean) => void;

  // Unit session
  unitSession: UnitSession | null;
  setUnitSession: (session: UnitSession | null) => void;

  // Logout
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isMasterAdmin: false,
      setMasterAdmin: (value) => set({ isMasterAdmin: value }),
      unitSession: null,
      setUnitSession: (session) => set({ unitSession: session }),
      logout: () => set({ isMasterAdmin: false, unitSession: null }),
    }),
    {
      name: "fvl-auth",
    }
  )
);
