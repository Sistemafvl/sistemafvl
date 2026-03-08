import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionType = "user" | "manager" | "driver" | "matriz";

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

interface ConferenteSession {
  id: string;
  name: string;
}

interface DomainUnit {
  id: string;
  name: string;
}

interface AuthState {
  unitSession: UnitSession | null;
  setUnitSession: (session: UnitSession | null) => void;

  managerSession: ManagerSession | null;
  setManagerSession: (session: ManagerSession | null) => void;

  conferenteSession: ConferenteSession | null;
  setConferenteSession: (session: ConferenteSession | null) => void;

  // Director: domain units for switching
  domainUnits: DomainUnit[];
  setDomainUnits: (units: DomainUnit[]) => void;
  setActiveUnit: (unitId: string, unitName: string) => void;

  // Master Admin
  isMasterAdmin: boolean;
  setMasterAdmin: (v: boolean) => void;

  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      unitSession: null,
      setUnitSession: (session) => set({ unitSession: session }),
      managerSession: null,
      setManagerSession: (session) => set({ managerSession: session }),
      conferenteSession: null,
      setConferenteSession: (session) => set({ conferenteSession: session }),
      domainUnits: [],
      setDomainUnits: (units) => set({ domainUnits: units }),
      setActiveUnit: (unitId, unitName) => set((state) => ({
        unitSession: state.unitSession ? {
          ...state.unitSession,
          id: unitId,
          name: unitName,
        } : null,
      })),
      isMasterAdmin: false,
      setMasterAdmin: (v) => set({ isMasterAdmin: v }),
      logout: () => set({ unitSession: null, managerSession: null, conferenteSession: null, domainUnits: [], isMasterAdmin: false }),
    }),
    {
      name: "fvl-auth",
      partialize: (state) => ({
        unitSession: state.unitSession,
        conferenteSession: state.conferenteSession,
        domainUnits: state.domainUnits,
        isMasterAdmin: state.isMasterAdmin,
      }),
    }
  )
);
