import React, { forwardRef } from "react";
import { COLORS, headerCellStyle, cellStyle } from "./pdf-styles";
import { formatCurrency } from "./pdf-utils";
import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";

export interface RankingRow {
  position: number;
  name: string;
  tbrs: number;
  returns: number;
  completionRate: string;
  daysWorked: number;
  avgDaily: number;
  value: number;
}

interface Props {
  data: RankingRow[];
  unitName: string;
  tbrValue: number;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  logoBase64: string;
}

const podiumColors: Record<number, string> = {
  1: "#fef3c7", // gold
  2: "#f1f5f9", // silver
  3: "#fed7aa", // bronze
};

const RankingReportContent = forwardRef<HTMLDivElement, Props>(
  ({ data, unitName, tbrValue, startDate, endDate, generatedBy, logoBase64 }, ref) => (
    <div ref={ref} style={{ display: "none", background: COLORS.white, fontFamily: "Arial, sans-serif", fontSize: "11px", color: COLORS.dark }}>
      <div style={{ padding: "16px" }}>
        <ReportHeader logoBase64={logoBase64} title="RANKING DE PERFORMANCE" unitName={unitName} startDate={startDate} endDate={endDate} generatedBy={generatedBy} />

        <div style={{ fontSize: "9px", color: COLORS.gray, marginBottom: "8px" }}>
          Valor por TBR: {formatCurrency(tbrValue)} | Ordenado por total de TBRs (desc)
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headerCellStyle()}>#</th>
              <th style={headerCellStyle({ textAlign: "left" })}>Motorista</th>
              <th style={headerCellStyle()}>TBRs</th>
              <th style={headerCellStyle()}>Retornos</th>
              <th style={headerCellStyle()}>Taxa Conclusão</th>
              <th style={headerCellStyle()}>Dias Trabalhados</th>
              <th style={headerCellStyle()}>Média/Dia</th>
              <th style={headerCellStyle()}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const bg = podiumColors[row.position] || (row.position % 2 === 0 ? COLORS.white : COLORS.grayLight);
              const isTop3 = row.position <= 3;
              return (
                <tr key={row.position}>
                  <td style={cellStyle({ fontWeight: isTop3 ? 800 : 600, background: bg, fontSize: isTop3 ? "11px" : "9px" })}>
                    {row.position === 1 ? "🥇" : row.position === 2 ? "🥈" : row.position === 3 ? "🥉" : row.position}
                  </td>
                  <td style={cellStyle({ textAlign: "left", fontWeight: isTop3 ? 700 : 400, background: bg })}>{row.name}</td>
                  <td style={cellStyle({ fontWeight: 700, background: bg })}>{row.tbrs}</td>
                  <td style={cellStyle({ background: bg })}>{row.returns}</td>
                  <td style={cellStyle({ background: bg })}>{row.completionRate}%</td>
                  <td style={cellStyle({ background: bg })}>{row.daysWorked}</td>
                  <td style={cellStyle({ background: bg })}>{row.avgDaily}</td>
                  <td style={cellStyle({ fontWeight: 700, background: bg })}>{formatCurrency(row.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <ReportFooter />
      </div>
    </div>
  )
);

RankingReportContent.displayName = "RankingReportContent";
export default RankingReportContent;
