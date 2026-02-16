import React from "react";
import { COLORS } from "./pdf-styles";

interface ReportFooterProps {
  showSignatures?: boolean;
}

const ReportFooter: React.FC<ReportFooterProps> = ({ showSignatures }) => (
  <div style={{ marginTop: "auto", paddingTop: "16px" }}>
    {showSignatures && (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "30px",
          marginBottom: "8px",
          padding: "0 40px",
        }}
      >
        <div style={{ textAlign: "center", width: "40%" }}>
          <div
            style={{
              borderTop: `1px solid ${COLORS.dark}`,
              paddingTop: "4px",
              fontSize: "9px",
              fontWeight: 600,
            }}
          >
            Assinatura do Gerente
          </div>
        </div>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div
            style={{
              borderTop: `1px solid ${COLORS.dark}`,
              paddingTop: "4px",
              fontSize: "9px",
              fontWeight: 600,
            }}
          >
            Assinatura do Motorista
          </div>
        </div>
      </div>
    )}
    <div
      style={{
        textAlign: "center",
        fontSize: "7px",
        color: COLORS.gray,
        borderTop: `1px solid ${COLORS.grayBorder}`,
        paddingTop: "4px",
      }}
    >
      Documento gerado pelo Sistema FVL — Uso interno
    </div>
  </div>
);

export default ReportFooter;
