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

interface ManagerSession {
  id: string;
  name: string;
  cnpj: string;
}

interface AuthState {
  // Master admin
  isMasterAdmin: boolean;
  setMasterAdmin: (value: boolean) => void;

  // Unit session
  unitSession: UnitSession | null;
  setUnitSession: (session: UnitSession | null) => void;

  // Manager session
  managerSession: ManagerSession | null;
  setManagerSession: (session: ManagerSession | null) => void;

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
      managerSession: null,
      setManagerSession: (session) => set({ managerSession: session }),
      logout: () => set({ isMasterAdmin: false, unitSession: null, managerSession: null }),
    }),
    {
      name: "fvl-auth",
      partialize: (state) => ({
        isMasterAdmin: state.isMasterAdmin,
        unitSession: state.unitSession,
      }),
    }
  )
);
