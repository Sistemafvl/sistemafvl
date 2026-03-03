import React, { forwardRef } from "react";
import { format } from "date-fns";
import { COLORS, headerCellStyle, cellStyle, altRowBg } from "./pdf-styles";
import { formatCpf, formatCurrency, formatDateBR } from "./pdf-utils";
import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";

export interface DriverPayrollData {
  driver: {
    id: string;
    name: string;
    cpf: string;
    car_plate: string;
    car_model: string;
    car_color: string | null;
    pixKey?: string | null;
  };
  days: {
    date: string;
    login: string | null;
    tbrCount: number;
    returns: number;
    completed: number;
    value: number;
  }[];
  totalTbrs: number;
  totalReturns: number;
  totalCompleted: number;
  totalValue: number;
  tbrValueUsed?: number;
  bonus?: number;
  dnrDiscount?: number;
  daysWorked: number;
  loginsUsed: string[];
  bestDay: { date: string; tbrs: number } | null;
  worstDay: { date: string; tbrs: number } | null;
  avgDaily: number;
}

interface Props {
  data: DriverPayrollData[];
  unitName: string;
  tbrValue: number;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  logoBase64: string;
}

const PayrollReportContent = forwardRef<HTMLDivElement, Props>(
  ({ data, unitName, tbrValue, startDate, endDate, generatedBy, logoBase64 }, ref) => {
    const allDates = [...new Set(data.flatMap((d) => d.days.map((day) => day.date)))].sort();

    const grandTotalTbrs = data.reduce((s, d) => s + d.totalTbrs, 0);
    const grandTotalReturns = data.reduce((s, d) => s + d.totalReturns, 0);
    const grandTotalCompleted = data.reduce((s, d) => s + d.totalCompleted, 0);
    const grandTotalValue = data.reduce((s, d) => s + d.totalValue, 0);
    const grandTotalDnr = data.reduce((s, d) => s + (d.dnrDiscount ?? 0), 0);
    const grandTotalBonus = data.reduce((s, d) => s + (d.bonus ?? 0), 0);

    const metricBox = (value: string | number, label: string, bg: string, textColor?: string) => (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 18px",
          margin: "4px",
          borderRadius: "8px",
          textAlign: "center",
          background: bg,
          minWidth: "100px",
          border: `1px solid ${COLORS.grayBorder}`,
        }}
      >
        <div style={{ fontSize: "22px", fontWeight: 800, color: textColor || COLORS.tealDark, lineHeight: "1.2" }}>{String(value)}</div>
        <div style={{ fontSize: "10px", color: COLORS.dark, textTransform: "uppercase", fontWeight: 700, marginTop: "2px" }}>{label}</div>
      </div>
    );

    return (
      <div
        ref={ref}
        style={{ background: COLORS.white, fontFamily: "Arial, sans-serif", fontSize: "11px", color: COLORS.dark }}
      >
        {/* Individual driver pages */}
        {data.map((d) => {
          const loginDayMap = new Map<string, Map<string, { tbrs: number; returns: number; completed: number }>>();
          d.days.forEach((day) => {
            const login = day.login || "Sem login";
            if (!loginDayMap.has(login)) loginDayMap.set(login, new Map());
            loginDayMap.get(login)!.set(day.date, { tbrs: day.tbrCount, returns: day.returns, completed: day.completed ?? (day.tbrCount - day.returns) });
          });
          const logins = [...loginDayMap.keys()].sort();
          const completionRate = d.totalTbrs > 0 ? ((d.totalCompleted / d.totalTbrs) * 100).toFixed(1) : "0.0";
          const dnrDiscount = d.dnrDiscount ?? 0;

          return (
            <div key={d.driver.id} style={{ padding: "16px", display: "flex", flexDirection: "column", minHeight: "680px" }}>
              <ReportHeader
                logoBase64={logoBase64}
                title="FOLHA DE PAGAMENTO"
                unitName={unitName}
                startDate={startDate}
                endDate={endDate}
                generatedBy={generatedBy}
              />

              {/* Driver info bar */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.tealDark})`,
                  color: COLORS.white,
                  padding: "8px 14px",
                  borderRadius: "6px",
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 800 }}>{d.driver.name}</div>
                  <div style={{ fontSize: "9px", opacity: 0.9 }}>
                    CPF: {formatCpf(d.driver.cpf)} | Placa: {d.driver.car_plate} | {d.driver.car_model}
                    {d.driver.car_color ? ` ${d.driver.car_color}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: "9px", opacity: 0.8 }}>
                  Valor TBR: {formatCurrency(d.tbrValueUsed ?? tbrValue)}
                </div>
              </div>

              {/* Metrics */}
              <div style={{ marginBottom: "10px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px" }}>
                {metricBox(d.totalTbrs, "TBRs", COLORS.tealLight)}
                {metricBox(d.totalReturns, "Retornos", "#fee2e2")}
                {metricBox(d.totalCompleted, "Concluídos", COLORS.green)}
                {metricBox(`${completionRate}%`, "Taxa", COLORS.gold)}
                {metricBox(d.avgDaily, "Média/Dia", COLORS.silver)}
                {dnrDiscount > 0 && metricBox(`-${formatCurrency(dnrDiscount)}`, "DNR", "#fee2e2", "#dc2626")}
                {(d.bonus ?? 0) > 0 && metricBox(`+${formatCurrency(d.bonus!)}`, "Adicional", COLORS.green)}
                {metricBox(formatCurrency(d.totalValue), "Valor Total", COLORS.tealLight)}
              </div>

              {/* Login x Days table */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
                <thead>
                  <tr>
                    <th style={headerCellStyle({ textAlign: "left" })}>Login</th>
                    {allDates.map((date) => (
                      <th key={date} style={headerCellStyle()}>{formatDateBR(date)}</th>
                    ))}
                    <th style={headerCellStyle()}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {logins.map((login, idx) => {
                    const dayData = loginDayMap.get(login)!;
                    const loginTotal = allDates.reduce((s, date) => {
                      const dd = dayData.get(date);
                      return s + ((dd?.tbrs ?? 0) - (dd?.returns ?? 0));
                    }, 0);
                    return (
                      <tr key={login}>
                        <td style={cellStyle({ fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", background: altRowBg(idx) })}>{login}</td>
                        {allDates.map((date) => {
                          const dd = dayData.get(date);
                          const val = (dd?.tbrs ?? 0) - (dd?.returns ?? 0);
                          return (
                            <td key={date} style={cellStyle({ background: val > 0 ? COLORS.green : altRowBg(idx) })}>
                              {val || "—"}
                            </td>
                          );
                        })}
                        <td style={cellStyle({ fontWeight: 700, background: COLORS.grayLight })}>{loginTotal}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={cellStyle({ fontWeight: 800, background: COLORS.tealLight })}>TOTAL</td>
                    {allDates.map((date) => {
                      const day = d.days.find((day) => day.date === date);
                      const dayTotal = day ? (day.completed ?? (day.tbrCount - day.returns)) : 0;
                      return <td key={date} style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{dayTotal || "—"}</td>;
                    })}
                    <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>{d.totalCompleted}</td>
                  </tr>
                </tbody>
              </table>

              <ReportFooter showSignatures />
            </div>
          );
        })}

        {/* Summary page */}
        <div style={{ padding: "16px" }}>
          <ReportHeader
            logoBase64={logoBase64}
            title="RESUMO GERAL — FOLHA DE PAGAMENTO"
            unitName={unitName}
            startDate={startDate}
            endDate={endDate}
            generatedBy={generatedBy}
          />

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCellStyle({ textAlign: "left" })}>Motorista</th>
                {allDates.map((date) => (
                  <th key={date} style={headerCellStyle()}>{formatDateBR(date)}</th>
                ))}
                <th style={headerCellStyle()}>TBRs</th>
                <th style={headerCellStyle()}>Ret.</th>
                <th style={headerCellStyle()}>Conc.</th>
                <th style={headerCellStyle()}>DNR</th>
                <th style={headerCellStyle()}>Adic.</th>
                <th style={headerCellStyle()}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, idx) => (
                <tr key={d.driver.id}>
                  <td style={cellStyle({ fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", background: altRowBg(idx) })}>
                    <div>{d.driver.name}</div>
                    {d.driver.pixKey && <div style={{ fontSize: "8px", color: "#888", fontWeight: 400 }}>PIX: {d.driver.pixKey}</div>}
                  </td>
                  {allDates.map((date) => {
                    const day = d.days.find((day) => day.date === date);
                    const val = day ? (day.completed ?? (day.tbrCount - day.returns)) : 0;
                    return <td key={date} style={cellStyle({ background: val > 0 ? COLORS.green : altRowBg(idx) })}>{val || "—"}</td>;
                  })}
                  <td style={cellStyle({ background: altRowBg(idx) })}>{d.totalTbrs}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{d.totalReturns}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{d.totalCompleted}</td>
                  <td style={cellStyle({ background: altRowBg(idx), color: (d.dnrDiscount ?? 0) > 0 ? "#dc2626" : undefined, fontWeight: (d.dnrDiscount ?? 0) > 0 ? 700 : undefined })}>
                    {(d.dnrDiscount ?? 0) > 0 ? `-${formatCurrency(d.dnrDiscount!)}` : "—"}
                  </td>
                  <td style={cellStyle({ background: altRowBg(idx), color: (d.bonus ?? 0) > 0 ? "#16a34a" : undefined, fontWeight: (d.bonus ?? 0) > 0 ? 700 : undefined })}>
                    {(d.bonus ?? 0) > 0 ? `+${formatCurrency(d.bonus!)}` : "—"}
                  </td>
                  <td style={cellStyle({ fontWeight: 700, background: altRowBg(idx) })}>{formatCurrency(d.totalValue)}</td>
                </tr>
              ))}
              <tr>
                <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>TOTAL</td>
                {allDates.map((date) => {
                  const dayTotal = data.reduce((s, d) => {
                    const day = d.days.find((day) => day.date === date);
                    return s + (day ? (day.completed ?? (day.tbrCount - day.returns)) : 0);
                  }, 0);
                  return <td key={date} style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{dayTotal || "—"}</td>;
                })}
                <td style={cellStyle({ fontWeight: 800, background: COLORS.tealLight })}>{grandTotalTbrs}</td>
                <td style={cellStyle({ fontWeight: 800, background: COLORS.tealLight })}>{grandTotalReturns}</td>
                <td style={cellStyle({ fontWeight: 800, background: COLORS.tealLight })}>{grandTotalCompleted}</td>
                <td style={cellStyle({ fontWeight: 800, background: "#fee2e2", color: "#dc2626" })}>
                  {grandTotalDnr > 0 ? `-${formatCurrency(grandTotalDnr)}` : "—"}
                </td>
                <td style={cellStyle({ fontWeight: 800, background: COLORS.green, color: "#16a34a" })}>
                  {grandTotalBonus > 0 ? `+${formatCurrency(grandTotalBonus)}` : "—"}
                </td>
                <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>{formatCurrency(grandTotalValue)}</td>
              </tr>
            </tbody>
          </table>

          <ReportFooter />
        </div>
      </div>
    );
  }
);

PayrollReportContent.displayName = "PayrollReportContent";
export default PayrollReportContent;
