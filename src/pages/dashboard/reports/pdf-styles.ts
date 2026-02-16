// Shared PDF report styles and constants

export const COLORS = {
  teal: "#0d9488",
  tealLight: "#ccfbf1",
  tealDark: "#134e4a",
  dark: "#1a1a1a",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
  grayBorder: "#d1d5db",
  white: "#ffffff",
  green: "#dcfce7",
  gold: "#fef3c7",
  silver: "#f1f5f9",
  bronze: "#fed7aa",
};

export const headerCellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: `1px solid ${COLORS.tealDark}`,
  padding: "5px 8px",
  fontSize: "8px",
  textAlign: "center" as const,
  background: COLORS.teal,
  color: COLORS.white,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  ...extra,
});

export const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: `1px solid ${COLORS.grayBorder}`,
  padding: "4px 6px",
  fontSize: "9px",
  textAlign: "center" as const,
  ...extra,
});

export const altRowBg = (index: number) =>
  index % 2 === 0 ? COLORS.white : COLORS.grayLight;
