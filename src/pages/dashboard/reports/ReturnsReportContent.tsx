import React, { forwardRef } from "react";
import { format } from "date-fns";
import { COLORS, headerCellStyle, cellStyle, altRowBg } from "./pdf-styles";
import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";

export interface ReturnEntry {
  tbr_code: string;
  description: string;
  driver_name: string | null;
  route: string | null;
  date: string;
  cep?: string | null;
}

interface Props {
  pisoEntries: ReturnEntry[];
  psEntries: ReturnEntry[];
  rtoEntries: ReturnEntry[];
  unitName: string;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  logoBase64: string;
}

const ReturnSection: React.FC<{
  title: string;
  entries: ReturnEntry[];
  showCep?: boolean;
  color: string;
}> = ({ title, entries, showCep, color }) => (
  <div style={{ marginBottom: "14px" }}>
    <div style={{ fontSize: "12px", fontWeight: 800, color, marginBottom: "4px", borderBottom: `2px solid ${color}`, paddingBottom: "2px" }}>
      {title} ({entries.length})
    </div>
    {entries.length === 0 ? (
      <div style={{ fontSize: "9px", color: COLORS.gray, padding: "6px" }}>Nenhum registro no período.</div>
    ) : (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={headerCellStyle()}>TBR Code</th>
            <th style={headerCellStyle()}>Descrição/Motivo</th>
            {showCep && <th style={headerCellStyle()}>CEP</th>}
            <th style={headerCellStyle()}>Motorista</th>
            <th style={headerCellStyle()}>Rota</th>
            <th style={headerCellStyle()}>Data</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, idx) => (
            <tr key={`${e.tbr_code}-${idx}`}>
              <td style={cellStyle({ fontWeight: 600, background: altRowBg(idx) })}>{e.tbr_code}</td>
              <td style={cellStyle({ textAlign: "left", background: altRowBg(idx) })}>{e.description}</td>
              {showCep && <td style={cellStyle({ background: altRowBg(idx) })}>{e.cep || "—"}</td>}
              <td style={cellStyle({ background: altRowBg(idx) })}>{e.driver_name || "—"}</td>
              <td style={cellStyle({ background: altRowBg(idx) })}>{e.route || "—"}</td>
              <td style={cellStyle({ background: altRowBg(idx) })}>{format(new Date(e.date), "dd/MM")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const ReturnsReportContent = forwardRef<HTMLDivElement, Props>(
  ({ pisoEntries, psEntries, rtoEntries, unitName, startDate, endDate, generatedBy, logoBase64 }, ref) => {
    const total = pisoEntries.length + psEntries.length + rtoEntries.length;
    return (
      <div ref={ref} style={{ display: "none", background: COLORS.white, fontFamily: "Arial, sans-serif", fontSize: "11px", color: COLORS.dark }}>
        <div style={{ padding: "16px" }}>
          <ReportHeader logoBase64={logoBase64} title="RELATÓRIO DE RETORNOS" unitName={unitName} startDate={startDate} endDate={endDate} generatedBy={generatedBy} />

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {[
              { label: "Piso", count: pisoEntries.length, bg: "#fee2e2" },
              { label: "PS", count: psEntries.length, bg: COLORS.gold },
              { label: "RTO", count: rtoEntries.length, bg: "#fce7f3" },
              { label: "Total", count: total, bg: COLORS.tealLight },
            ].map((m) => (
              <div key={m.label} style={{ padding: "6px 16px", borderRadius: "6px", background: m.bg, textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: COLORS.tealDark }}>{m.count}</div>
                <div style={{ fontSize: "7px", fontWeight: 600, color: COLORS.gray, textTransform: "uppercase" }}>{m.label}</div>
              </div>
            ))}
          </div>

          <ReturnSection title="RETORNOS PISO" entries={pisoEntries} color="#ef4444" />
          <ReturnSection title="RETORNOS PS" entries={psEntries} color="#f59e0b" />
          <ReturnSection title="RETORNOS RTO" entries={rtoEntries} showCep color="#ec4899" />

          <ReportFooter />
        </div>
      </div>
    );
  }
);

ReturnsReportContent.displayName = "ReturnsReportContent";
export default ReturnsReportContent;
