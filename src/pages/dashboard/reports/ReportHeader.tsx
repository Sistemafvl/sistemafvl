import React from "react";
import { format } from "date-fns";
import { COLORS } from "./pdf-styles";

interface ReportHeaderProps {
  logoBase64: string;
  title: string;
  unitName: string;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
  logoBase64,
  title,
  unitName,
  startDate,
  endDate,
  generatedBy,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `3px solid ${COLORS.teal}`,
      paddingBottom: "8px",
      marginBottom: "12px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {logoBase64 && (
        <img
          src={logoBase64}
          alt="Logo"
          style={{ height: "40px", width: "auto" }}
        />
      )}
      <div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 800,
            color: COLORS.tealDark,
            letterSpacing: "1px",
          }}
        >
          {title}
        </div>
        <div
          style={{ fontSize: "12px", fontWeight: 700, color: COLORS.dark }}
        >
          {unitName}
        </div>
      </div>
    </div>
    <div style={{ textAlign: "right", fontSize: "8px", color: COLORS.gray }}>
      <div>
        Período: {format(startDate, "dd/MM/yyyy")} a{" "}
        {format(endDate, "dd/MM/yyyy")}
      </div>
      <div>Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      <div>Gerado por: {generatedBy}</div>
    </div>
  </div>
);

export default ReportHeader;
