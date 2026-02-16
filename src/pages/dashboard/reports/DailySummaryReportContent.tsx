import React, { forwardRef } from "react";
import { COLORS, headerCellStyle, cellStyle, altRowBg } from "./pdf-styles";
import { formatDateBR } from "./pdf-utils";
import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";

export interface DailySummaryRow {
  date: string;
  loadings: number;
  tbrs: number;
  piso: number;
  ps: number;
  rto: number;
  totalReturns: number;
  activeDrivers: number;
}

interface Props {
  data: DailySummaryRow[];
  unitName: string;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  logoBase64: string;
}

const DailySummaryReportContent = forwardRef<HTMLDivElement, Props>(
  ({ data, unitName, startDate, endDate, generatedBy, logoBase64 }, ref) => {
    const totals = data.reduce(
      (acc, r) => ({
        loadings: acc.loadings + r.loadings,
        tbrs: acc.tbrs + r.tbrs,
        piso: acc.piso + r.piso,
        ps: acc.ps + r.ps,
        rto: acc.rto + r.rto,
        totalReturns: acc.totalReturns + r.totalReturns,
      }),
      { loadings: 0, tbrs: 0, piso: 0, ps: 0, rto: 0, totalReturns: 0 }
    );

    return (
      <div ref={ref} style={{ display: "none", background: COLORS.white, fontFamily: "Arial, sans-serif", fontSize: "11px", color: COLORS.dark }}>
        <div style={{ padding: "16px" }}>
          <ReportHeader logoBase64={logoBase64} title="RESUMO DIÁRIO DE OPERAÇÃO" unitName={unitName} startDate={startDate} endDate={endDate} generatedBy={generatedBy} />

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerCellStyle()}>Data</th>
                <th style={headerCellStyle()}>Carregamentos</th>
                <th style={headerCellStyle()}>TBRs</th>
                <th style={headerCellStyle()}>Piso</th>
                <th style={headerCellStyle()}>PS</th>
                <th style={headerCellStyle()}>RTO</th>
                <th style={headerCellStyle()}>Total Retornos</th>
                <th style={headerCellStyle()}>Motoristas Ativos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={row.date}>
                  <td style={cellStyle({ fontWeight: 600, background: altRowBg(idx) })}>{formatDateBR(row.date)}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{row.loadings}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{row.tbrs}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{row.piso}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{row.ps}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{row.rto}</td>
                  <td style={cellStyle({ background: altRowBg(idx), fontWeight: 600 })}>{row.totalReturns}</td>
                  <td style={cellStyle({ background: altRowBg(idx) })}>{row.activeDrivers}</td>
                </tr>
              ))}
              <tr>
                <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>TOTAL</td>
                <td style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{totals.loadings}</td>
                <td style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{totals.tbrs}</td>
                <td style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{totals.piso}</td>
                <td style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{totals.ps}</td>
                <td style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>{totals.rto}</td>
                <td style={cellStyle({ fontWeight: 800, background: COLORS.teal, color: COLORS.white })}>{totals.totalReturns}</td>
                <td style={cellStyle({ fontWeight: 700, background: COLORS.tealLight })}>—</td>
              </tr>
            </tbody>
          </table>

          <ReportFooter />
        </div>
      </div>
    );
  }
);

DailySummaryReportContent.displayName = "DailySummaryReportContent";
export default DailySummaryReportContent;
