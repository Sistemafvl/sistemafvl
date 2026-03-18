import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Get current date in Brazil timezone (America/Sao_Paulo) */
export function getBrazilNow(): Date {
  const now = new Date();
  const brStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brStr);
}

/** Get today's date string in yyyy-MM-dd format in Brazil timezone */
export function getBrazilTodayStr(): string {
  const br = getBrazilNow();
  const yyyy = br.getFullYear();
  const mm = String(br.getMonth() + 1).padStart(2, "0");
  const dd = String(br.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Get start and end of a given date (yyyy-MM-dd) in Brazil timezone as ISO strings (UTC) */
export function getBrazilDayRange(dateStr?: string): { start: string; end: string } {
  const br = dateStr ?? getBrazilTodayStr();
  return {
    start: `${br}T03:00:00.000Z`,
    end: new Date(new Date(`${br}T03:00:00.000Z`).getTime() + 86400000 - 1).toISOString(),
  };
}

/** Validate TBR code: must start with "TBR" followed by digits only */
export function isValidTbrCode(code: string): boolean {
  const upper = code.toUpperCase();
  if (!upper.startsWith("TBR")) return false;
  const rest = upper.slice(3);
  return rest.length > 0 && /^\d+$/.test(rest);
}

/** Format a number as BRL currency (R$ 1.234,56) */
export function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Format an ISO date to dd/MM/yyyy in Brazil timezone */
export function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Get yyyy-MM-dd for an ISO date in Brazil timezone */
export function toBrazilDateStr(iso: string): string {
  const d = new Date(iso);
  const brStr = d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const br = new Date(brStr);
  const yyyy = br.getFullYear();
  const mm = String(br.getMonth() + 1).padStart(2, "0");
  const dd = String(br.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
/** Get current fortnight range (1-15 or 16-last) in Brazil timezone */
export function getBrazilFortnightRange(): { start: Date; end: Date } {
  const br = getBrazilNow();
  const day = br.getDate();
  const month = br.getMonth();
  const year = br.getFullYear();
  
  if (day <= 15) {
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month, 15, 23, 59, 59, 999)
    };
  } else {
    // 16 to last day of month
    return {
      start: new Date(year, month, 16),
      end: new Date(year, month + 1, 0, 23, 59, 59, 999)
    };
  }
}
