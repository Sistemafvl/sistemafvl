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
  reativoTotal?: number;
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

// Compact cell styles for summary table
const compactHeaderStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: `1px solid ${COLORS.tealDark}`,
  padding: "3px 4px",
  fontSize: "7px",
  textAlign: "center" as const,
  background: COLORS.teal,
  color: COLORS.white,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
  whiteSpace: "nowrap" as const,
  ...extra,
});

const compactCellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: `1px solid ${COLORS.grayBorder}`,
  padding: "2px 3px",
  fontSize: "7px",
  textAlign: "center" as const,
  whiteSpace: "nowrap" as const,
  ...extra,
});

const PayrollReportContent = forwardRef<HTMLDivElement, Props>(
  ({ data, unitName, tbrValue, startDate, endDate, generatedBy, logoBase64 }, ref) => {
    const allDates = [...new Set(data.flatMap((d) => d.days.map((day) => day.date)))].sort();

    const grandTotalTbrs = data.reduce((s, d) => s + d.totalTbrs, 0);
    const grandTotalReturns = data.reduce((s, d) => s + d.totalReturns, 0);
    const grandTotalCompleted = data.reduce((s, d) => s + d.totalCompleted, 0);
    const grandTotalValue = data.reduce((s, d) => s + d.totalValue, 0);
    const grandTotalDnr = data.reduce((s, d) => s + (d.dnrDiscount ?? 0), 0);
    const grandTotalBonus = data.reduce((s, d) => s + (d.bonus ?? 0), 0);
    const grandTotalReativo = data.reduce((s, d) => s + (d.reativoTotal ?? 0), 0);

    const getVehicleType = (tbrVal: number) => (tbrVal <= 2.5 ? "MOTO" : "CARRO");

    return (
      <div
        ref={ref}
        style={{ background: COLORS.white, fontFamily: "Arial, sans-serif", fontSize: "11px", color: COLORS.dark }}
      >
        {/* ══════════════ SUMMARY PAGE FIRST ══════════════ */}
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", minHeight: "680px" }}>
          <ReportHeader
            logoBase64={logoBase64}
            title="FOLHA DE PAGAMENTO — RESUMO GERAL"
            unitName={unitName}
            startDate={startDate}
            endDate={endDate}
            generatedBy={generatedBy}
          />

          {/* Main drivers table */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.tealDark})`,
                color: COLORS.white,
                padding: "4px 10px",
                borderRadius: "4px 4px 0 0",
                fontSize: "10px",
                fontWeight: 700,
              }}
            >
              MOTORISTAS FIXOS POR PACOTES
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={compactHeaderStyle({ textAlign: "left", minWidth: "100px" })}>Nome</th>
                  <th style={compactHeaderStyle({ minWidth: "40px" })}>Veíc.</th>
                  <th style={compactHeaderStyle({ minWidth: "50px" })}>Valor</th>
                  {allDates.map((date) => (
                    <th key={date} style={compactHeaderStyle({ minWidth: "28px" })}>{formatDateBR(date)}</th>
                  ))}
                  <th style={compactHeaderStyle({ minWidth: "35px" })}>Total</th>
                  <th style={compactHeaderStyle({ minWidth: "50px" })}>Desc.</th>
                  <th style={compactHeaderStyle({ minWidth: "50px" })}>Adic.</th>
                  <th style={compactHeaderStyle({ minWidth: "60px" })}>Total R$</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, idx) => {
                  const tbrVal = d.tbrValueUsed ?? tbrValue;
                  const adicional = (d.bonus ?? 0) + (d.reativoTotal ?? 0);
                  return (
                    <tr key={d.driver.id}>
                      <td style={compactCellStyle({ fontWeight: 600, textAlign: "left", background: altRowBg(idx) })}>
                        {d.driver.name}
                      </td>
                      <td style={compactCellStyle({ background: altRowBg(idx) })}>{getVehicleType(tbrVal)}</td>
                      <td style={compactCellStyle({ background: altRowBg(idx) })}>{formatCurrency(tbrVal)}</td>
                      {allDates.map((date) => {
                        const day = d.days.find((day) => day.date === date);
                        const val = day ? (day.completed ?? (day.tbrCount - day.returns)) : 0;
                        return (
                          <td key={date} style={compactCellStyle({ background: val > 0 ? COLORS.green : altRowBg(idx) })}>
                            {val || "—"}
                          </td>
                        );
                      })}
                      <td style={compactCellStyle({ fontWeight: 700, background: COLORS.grayLight })}>{d.totalCompleted}</td>
                      <td style={compactCellStyle({ background: altRowBg(idx), color: (d.dnrDiscount ?? 0) > 0 ? "#dc2626" : undefined })}>
                        {(d.dnrDiscount ?? 0) > 0 ? `-${formatCurrency(d.dnrDiscount!)}` : "—"}
                      </td>
                      <td style={compactCellStyle({ background: altRowBg(idx), color: adicional > 0 ? "#16a34a" : undefined })}>
                        {adicional > 0 ? `+${formatCurrency(adicional)}` : "—"}
                      </td>
                      <td style={compactCellStyle({ fontWeight: 700, background: altRowBg(idx) })}>{formatCurrency(d.totalValue)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={compactCellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })} colSpan={2}>TOTAL</td>
                  <td style={compactCellStyle({ fontWeight: 700, background: COLORS.tealLight })}></td>
                  {allDates.map((date) => {
                    const dayTotal = data.reduce((s, d) => {
                      const day = d.days.find((day) => day.date === date);
                      return s + (day ? (day.completed ?? (day.tbrCount - day.returns)) : 0);
                    }, 0);
                    return <td key={date} style={compactCellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{dayTotal || "—"}</td>;
                  })}
                  <td style={compactCellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>{grandTotalCompleted}</td>
                  <td style={compactCellStyle({ fontWeight: 700, background: "#fee2e2", color: "#dc2626" })}>
                    {grandTotalDnr > 0 ? `-${formatCurrency(grandTotalDnr)}` : "—"}
                  </td>
                  <td style={compactCellStyle({ fontWeight: 700, background: COLORS.green, color: "#16a34a" })}>
                    {(grandTotalBonus + grandTotalReativo) > 0 ? `+${formatCurrency(grandTotalBonus + grandTotalReativo)}` : "—"}
                  </td>
                  <td style={compactCellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>{formatCurrency(grandTotalValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Resumo consolidado */}
          <div style={{ display: "flex", gap: "16px", marginTop: "auto" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "9px", fontWeight: 700, background: COLORS.grayLight, padding: "4px 8px", borderRadius: "4px 4px 0 0" }}>
                RESUMO FINANCEIRO
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={compactHeaderStyle({ textAlign: "left" })}>Descrição</th>
                    <th style={compactHeaderStyle()}>Pacotes</th>
                    <th style={compactHeaderStyle()}>Valor Total</th>
                    <th style={compactHeaderStyle()}>Média/Pacote</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={compactCellStyle({ textAlign: "left", fontWeight: 600 })}>Motoristas por Pacotes</td>
                    <td style={compactCellStyle()}>{grandTotalCompleted}</td>
                    <td style={compactCellStyle()}>{formatCurrency(grandTotalValue)}</td>
                    <td style={compactCellStyle()}>{grandTotalCompleted > 0 ? formatCurrency(grandTotalValue / grandTotalCompleted) : "—"}</td>
                  </tr>
                  <tr>
                    <td style={compactCellStyle({ textAlign: "left", fontWeight: 800, background: COLORS.tealLight })}>TOTAL GERAL</td>
                    <td style={compactCellStyle({ fontWeight: 800, background: COLORS.tealLight })}>{grandTotalCompleted}</td>
                    <td style={compactCellStyle({ fontWeight: 800, background: COLORS.tealLight })}>{formatCurrency(grandTotalValue)}</td>
                    <td style={compactCellStyle({ fontWeight: 800, background: COLORS.tealLight })}>
                      {grandTotalCompleted > 0 ? formatCurrency(grandTotalValue / grandTotalCompleted) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <ReportFooter />
        </div>

        {/* ══════════════ INDIVIDUAL DRIVER PAGES ══════════════ */}
        {data.map((d) => {
          const tbrVal = d.tbrValueUsed ?? tbrValue;
          const adicional = (d.bonus ?? 0) + (d.reativoTotal ?? 0);
          const subtotal = d.totalCompleted * tbrVal;
          const totalPagar = subtotal - (d.dnrDiscount ?? 0) + adicional;

          return (
            <div key={d.driver.id} style={{ padding: "16px", display: "flex", flexDirection: "column", minHeight: "680px" }}>
              <ReportHeader
                logoBase64={logoBase64}
                title="FOLHA DE PAGAMENTO — INDIVIDUAL"
                unitName={unitName}
                startDate={startDate}
                endDate={endDate}
                generatedBy={generatedBy}
              />

              {/* Driver info section */}
              <div
                style={{
                  background: "#DBEAFE",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, color: COLORS.tealDark, marginBottom: "8px" }}>
                  RESUMO DO MOTORISTA
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "10px" }}>
                  <div><strong>Nome:</strong> {d.driver.name}</div>
                  <div><strong>CPF:</strong> {formatCpf(d.driver.cpf)}</div>
                  <div><strong>Veículo:</strong> {getVehicleType(tbrVal)}</div>
                  <div><strong>Placa:</strong> {d.driver.car_plate}</div>
                  <div><strong>Modelo:</strong> {d.driver.car_model}{d.driver.car_color ? ` ${d.driver.car_color}` : ""}</div>
                  <div><strong>Chave PIX:</strong> {d.driver.pixKey ?? "—"}</div>
                  <div><strong>Valor/Pacote:</strong> {formatCurrency(tbrVal)}</div>
                </div>
              </div>

              {/* Daily detail table */}
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    background: "#DBEAFE",
                    padding: "4px 10px",
                    borderRadius: "4px 4px 0 0",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: COLORS.tealDark,
                  }}
                >
                  DETALHAMENTO DIÁRIO
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={headerCellStyle({ textAlign: "left", width: "100px" })}>Data</th>
                      <th style={headerCellStyle()}>Login</th>
                      <th style={headerCellStyle()}>Pacotes</th>
                      <th style={headerCellStyle()}>Retornos</th>
                      <th style={headerCellStyle()}>Concluídos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.days.length > 0 ? (
                      d.days.map((day, idx) => {
                        const completed = day.completed ?? (day.tbrCount - day.returns);
                        return (
                          <tr key={day.date}>
                            <td style={cellStyle({ textAlign: "left", background: altRowBg(idx) })}>
                              {format(new Date(day.date + "T12:00:00"), "dd/MM/yyyy")}
                            </td>
                            <td style={cellStyle({ background: altRowBg(idx) })}>{day.login || "—"}</td>
                            <td style={cellStyle({ background: altRowBg(idx) })}>{day.tbrCount}</td>
                            <td style={cellStyle({ background: day.returns > 0 ? "#fee2e2" : altRowBg(idx) })}>{day.returns}</td>
                            <td style={cellStyle({ background: completed > 0 ? COLORS.green : altRowBg(idx), fontWeight: 600 })}>{completed}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} style={cellStyle({ color: COLORS.gray })}>Nenhum registro no período</td>
                      </tr>
                    )}
                    <tr>
                      <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })} colSpan={2}>TOTAL</td>
                      <td style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{d.totalTbrs}</td>
                      <td style={cellStyle({ fontWeight: 700, background: "#fee2e2" })}>{d.totalReturns}</td>
                      <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>{d.totalCompleted}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial summary */}
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    background: "#DBEAFE",
                    padding: "4px 10px",
                    borderRadius: "4px 4px 0 0",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: COLORS.tealDark,
                  }}
                >
                  RESUMO FINANCEIRO
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", maxWidth: "400px" }}>
                  <tbody>
                    <tr>
                      <td style={cellStyle({ textAlign: "left", fontWeight: 600 })}>Total Pacotes Concluídos</td>
                      <td style={cellStyle({ fontWeight: 700 })}>{d.totalCompleted}</td>
                    </tr>
                    <tr>
                      <td style={cellStyle({ textAlign: "left", fontWeight: 600, background: COLORS.grayLight })}>Valor por Pacote</td>
                      <td style={cellStyle({ background: COLORS.grayLight })}>{formatCurrency(tbrVal)}</td>
                    </tr>
                    <tr>
                      <td style={cellStyle({ textAlign: "left", fontWeight: 600 })}>Subtotal (Pacotes × Valor)</td>
                      <td style={cellStyle({ fontWeight: 700 })}>{formatCurrency(subtotal)}</td>
                    </tr>
                    <tr>
                      <td style={cellStyle({ textAlign: "left", fontWeight: 600, background: "#fee2e2" })}>Descontos (DNR)</td>
                      <td style={cellStyle({ background: "#fee2e2", color: (d.dnrDiscount ?? 0) > 0 ? "#dc2626" : undefined, fontWeight: 600 })}>
                        {(d.dnrDiscount ?? 0) > 0 ? `-${formatCurrency(d.dnrDiscount!)}` : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td style={cellStyle({ textAlign: "left", fontWeight: 600, background: COLORS.green })}>Adicional (Bônus + Reativo)</td>
                      <td style={cellStyle({ background: COLORS.green, color: adicional > 0 ? "#16a34a" : undefined, fontWeight: 600 })}>
                        {adicional > 0 ? `+${formatCurrency(adicional)}` : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td style={cellStyle({ textAlign: "left", fontWeight: 800, background: COLORS.teal, color: COLORS.white, fontSize: "11px" })}>
                        TOTAL A PAGAR
                      </td>
                      <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white, fontSize: "12px" })}>
                        {formatCurrency(totalPagar)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <ReportFooter showSignatures />
            </div>
          );
        })}
      </div>
    );
  }
);

PayrollReportContent.displayName = "PayrollReportContent";
export default PayrollReportContent;
