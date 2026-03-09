import XLSX from "xlsx-js-style";
import { format } from "date-fns";
import type { DriverPayrollData } from "./PayrollReportContent";

const formatCurrencyBR = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatCpfBR = (cpf: string) => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length === 11)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  return cpf;
};

export interface MinPackageDriver {
  driverId: string;
  driverName: string;
  minPackages: number;
  tbrValueUsed: number;
  cpf: string;
  pixKey?: string | null;
}

// ── Style constants ──
const borderThin = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
};

const yellowFill = { fgColor: { rgb: "FFD700" } };
const greenFill = { fgColor: { rgb: "92D050" } };
const grayFill = { fgColor: { rgb: "D9D9D9" } };
const lightBlueFill = { fgColor: { rgb: "DBEAFE" } };
const boldFont = { bold: true, sz: 11 };
const boldFontLg = { bold: true, sz: 13 };
const centerAlign = { horizontal: "center", vertical: "center" };
const leftAlign = { horizontal: "left", vertical: "center" };

// ── Helper: apply style to a range of cells ──
function applyStyleToRow(
  ws: XLSX.WorkSheet,
  row: number,
  colStart: number,
  colEnd: number,
  style: Record<string, unknown>,
) {
  for (let c = colStart; c <= colEnd; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = { ...(ws[addr].s || {}), ...style };
  }
}

function mergeRow(ws: XLSX.WorkSheet, row: number, colStart: number, colEnd: number) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: row, c: colStart }, e: { r: row, c: colEnd } });
}

// Helper to set a cell with formula
function setCellFormula(ws: XLSX.WorkSheet, row: number, col: number, formula: string, style?: Record<string, unknown>) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  ws[addr] = { t: "n", f: formula };
  if (style) ws[addr].s = style;
}

// Helper to apply currency format to a column range
function applyCurrencyFormat(ws: XLSX.WorkSheet, col: number, rowStart: number, rowEnd: number) {
  const currencyFmt = '"R$" #,##0.00';
  for (let r = rowStart; r <= rowEnd; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: col });
    if (ws[addr]) {
      ws[addr].z = currencyFmt;
      ws[addr].s = { ...(ws[addr].s || {}), numFmt: currencyFmt };
    }
  }
}

// Helper to get Excel column letter
function colLetter(col: number): string {
  let result = "";
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

// Sanitize sheet name for Excel (max 31 chars, no special chars)
function sanitizeSheetName(name: string): string {
  return name
    .replace(/[\\/*?:\[\]]/g, "")
    .substring(0, 31)
    .trim();
}

export function generatePayrollExcel(
  data: DriverPayrollData[],
  unitName: string,
  startDate: Date,
  endDate: Date,
  generatedBy?: string,
  minPackageDrivers?: MinPackageDriver[],
) {
  const allDates = [
    ...new Set(data.flatMap((d) => d.days.map((day) => day.date))),
  ].sort();

  const minDrivers = minPackageDrivers ?? [];

  const fixedHeaders = [
    "NOME COMPLETO",
    "Veículo",
    "VALOR POR PACOTE",
    "TOTAL DE PACOTES ENTREGUES",
    "DESCONTOS",
    "ADICIONAL",
    "TOTAL GERAL",
    "CPF",
    "CHAVE PIX",
  ];
  const dateHeaders = allDates.map((d) =>
    format(new Date(d + "T12:00:00"), "dd/MM"),
  );
  const headers = [...fixedHeaders, ...dateHeaders, "TOTAL"];
  const totalCols = headers.length;
  const lastCol = totalCols - 1;
  
  // Column indices
  const COL_NAME = 0;
  const COL_VEHICLE = 1;
  const COL_VALUE = 2;
  const COL_PACKAGES = 3;
  const COL_DISCOUNTS = 4;
  const COL_ADDITIONAL = 5;
  const COL_TOTAL_GERAL = 6;
  const COL_CPF = 7;
  const COL_PIX = 8;
  const COL_DATES_START = 9;
  const COL_TOTAL = lastCol;

  // ── Build minPackage DriverPayrollData entries ──
  const minPkgPayrollData: DriverPayrollData[] = minDrivers.map((mp) => {
    const existing = data.find((d) => d.driver.id === mp.driverId);
    if (existing) return existing;
    return {
      driver: {
        id: mp.driverId,
        name: mp.driverName,
        cpf: mp.cpf,
        car_plate: "",
        car_model: "",
        car_color: null,
        pixKey: mp.pixKey,
      },
      days: [],
      totalTbrs: 0,
      totalReturns: 0,
      totalCompleted: 0,
      totalValue: 0,
      tbrValueUsed: mp.tbrValueUsed,
      bonus: 0,
      dnrDiscount: 0,
      reativoTotal: 0,
      daysWorked: 0,
      loginsUsed: [],
      bestDay: null,
      worstDay: null,
      avgDaily: 0,
    };
  });

  // ══════════════ BUILD MAIN WORKSHEET DATA ══════════════
  const wsData: (string | number)[][] = [];

  // Track row indices for styling
  const rowTracker = {
    titleRow: 0,
    dataFinanceiraRow: 2,
    metaRow: 3,
    headerRow: 4,
    dataStartRow: 5,
    dataEndRow: 0,
    totalRow: 0,
    // Section 2 - Min packages
    minTitleRow: -1,
    minDataFinRow: -1,
    minHeaderRow: -1,
    minDataStartRow: -1,
    minDataEndRow: -1,
    minTotalRow: -1,
    // Section 3
    consolidadoHeaderRow: -1,
    consolidadoRows: [] as number[],
    // Section 4
    resumoHeaderRow: -1,
    resumoRows: [] as number[],
  };

  // ── SECTION 1: HEADER ──
  wsData.push(["MOTORISTAS FIXOS POR PACOTES"]); // row 0
  wsData.push([]); // row 1
  wsData.push(["DADOS FINANCEIROS"]); // row 2
  wsData.push([
    `Unidade: ${unitName}`,
    "",
    "",
    `Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`,
    "",
    "",
    `Gerado por: ${generatedBy ?? "Sistema"}`,
  ]); // row 3
  wsData.push(headers); // row 4

  // ── SECTION 1: MAIN DRIVER ROWS (values only, formulas added after) ──
  data.forEach((d) => {
    const tbrVal = d.tbrValueUsed ?? 0;
    const vehicleType = tbrVal <= 2.5 ? "MOTO" : "CARRO";
    const descontos = d.dnrDiscount ?? 0;
    const adicional = (d.bonus ?? 0) + (d.reativoTotal ?? 0);

    const dailyValues = allDates.map((date) => {
      const day = d.days.find((day) => day.date === date);
      if (!day) return "";
      return day.completed ?? day.tbrCount - day.returns;
    });

    wsData.push([
      d.driver.name,
      vehicleType,
      tbrVal, // numeric for formula
      d.totalCompleted, // will be replaced by formula
      descontos > 0 ? descontos : "", // numeric
      adicional > 0 ? adicional : "", // numeric
      0, // placeholder for formula
      formatCpfBR(d.driver.cpf),
      d.driver.pixKey ?? "",
      ...dailyValues,
      0, // placeholder for TOTAL formula
    ]);
  });
  rowTracker.dataEndRow = wsData.length - 1;

  // ── SECTION 1: TOTALS ROW (placeholders) ──
  wsData.push([
    "TOTAL",
    "",
    "",
    0, // formula
    0, // formula
    0, // formula
    0, // formula
    "",
    "",
    ...allDates.map(() => 0), // formulas
    0, // formula
  ]);
  rowTracker.totalRow = wsData.length - 1;

  // ── SPACE ──
  wsData.push([]);
  wsData.push([]);

  // ── SECTION 2: MINIMUM PACKAGES DRIVERS (ALWAYS CREATED) ──
  rowTracker.minTitleRow = wsData.length;
  wsData.push(["MOTORISTAS - MÍNIMO DE 60 (SESSENTA) PACOTES"]);

  rowTracker.minDataFinRow = wsData.length;
  wsData.push(["DADOS FINANCEIROS"]);

  rowTracker.minHeaderRow = wsData.length;
  wsData.push(headers);

  rowTracker.minDataStartRow = wsData.length;
  
  // Add existing min package drivers or empty rows
  const minRowsToCreate = Math.max(minPkgPayrollData.length, 10);
  for (let i = 0; i < minRowsToCreate; i++) {
    const d = minPkgPayrollData[i];
    if (d) {
      const tbrVal = d.tbrValueUsed ?? 0;
      const vehicleType = tbrVal <= 2.5 ? "MOTO" : "CARRO";
      const descontos = d.dnrDiscount ?? 0;
      const adicional = (d.bonus ?? 0) + (d.reativoTotal ?? 0);
      const dailyValues = allDates.map((date) => {
        const day = d.days.find((day) => day.date === date);
        if (!day) return "";
        return day.completed ?? day.tbrCount - day.returns;
      });
      wsData.push([
        d.driver.name,
        vehicleType,
        tbrVal,
        d.totalCompleted,
        descontos > 0 ? descontos : "",
        adicional > 0 ? adicional : "",
        0,
        formatCpfBR(d.driver.cpf),
        d.driver.pixKey ?? "",
        ...dailyValues,
        0,
      ]);
    } else {
      // Empty row with structure for manual entry
      wsData.push([
        "",
        "",
        0,
        0,
        "",
        "",
        0,
        "",
        "",
        ...allDates.map(() => ""),
        0,
      ]);
    }
  }
  rowTracker.minDataEndRow = wsData.length - 1;

  // Min packages total row
  wsData.push([
    "TOTAL",
    "",
    "",
    0,
    0,
    0,
    0,
    "",
    "",
    ...allDates.map(() => 0),
    0,
  ]);
  rowTracker.minTotalRow = wsData.length - 1;

  wsData.push([]);
  wsData.push([]);

  // ── SECTION 3: CONSOLIDATED BLOCK ──
  rowTracker.consolidadoHeaderRow = wsData.length;
  wsData.push(["CONSOLIDADO", "", "", "", "", "", "", "", "", ...dateHeaders, "TOTAL"]);

  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "MOTORISTAS POR PACOTES",
    "", "", "", "", "", "", "", "",
    ...allDates.map(() => 0),
    0,
  ]);

  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "MOTORISTAS - MÍNIMO DE 60 PACOTES",
    "", "", "", "", "", "", "", "",
    ...allDates.map(() => 0),
    0,
  ]);

  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "Total Pacotes",
    "", "", "", "", "", "", "", "",
    ...allDates.map(() => 0),
    0,
  ]);

  // ── SPACE ──
  wsData.push([]);
  wsData.push([]);

  // ── SECTION 4: EXPANDED SUMMARY ──
  rowTracker.resumoHeaderRow = wsData.length;
  wsData.push(["RESUMO", "Qtd. Pacotes Entregues", "Valor Total", "Média Pacote"]);

  rowTracker.resumoRows.push(wsData.length);
  wsData.push(["MOTORISTAS POR PACOTES", 0, 0, 0]);

  rowTracker.resumoRows.push(wsData.length);
  wsData.push(["MOTORISTAS - MÍNIMO DE 60 PACOTES", 0, 0, 0]);

  rowTracker.resumoRows.push(wsData.length);
  wsData.push(["CUSTO POR PACOTE", 0, 0, 0]);

  // ══════════════ CREATE WORKSHEET ══════════════
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ══════════════ ADD FORMULAS ══════════════
  
  // Main data rows - add formulas
  for (let r = rowTracker.dataStartRow; r <= rowTracker.dataEndRow; r++) {
    const excelRow = r + 1; // Excel is 1-indexed
    
    // TOTAL column (sum of daily values)
    const dateStartCol = colLetter(COL_DATES_START);
    const dateEndCol = colLetter(COL_TOTAL - 1);
    setCellFormula(ws, r, COL_TOTAL, `SUM(${dateStartCol}${excelRow}:${dateEndCol}${excelRow})`);
    
    // TOTAL DE PACOTES ENTREGUES = TOTAL column value
    setCellFormula(ws, r, COL_PACKAGES, `${colLetter(COL_TOTAL)}${excelRow}`);
    
    // TOTAL GERAL = (Pacotes * Valor) - Descontos + Adicional
    const packagesCell = `${colLetter(COL_PACKAGES)}${excelRow}`;
    const valueCell = `${colLetter(COL_VALUE)}${excelRow}`;
    const discountsCell = `${colLetter(COL_DISCOUNTS)}${excelRow}`;
    const additionalCell = `${colLetter(COL_ADDITIONAL)}${excelRow}`;
    setCellFormula(ws, r, COL_TOTAL_GERAL, `(${packagesCell}*${valueCell})-IF(${discountsCell}="",0,${discountsCell})+IF(${additionalCell}="",0,${additionalCell})`);
  }
  
  // Main TOTAL row formulas
  const totalExcelRow = rowTracker.totalRow + 1;
  const dataStartExcelRow = rowTracker.dataStartRow + 1;
  const dataEndExcelRow = rowTracker.dataEndRow + 1;
  
  // Sum for TOTAL DE PACOTES
  setCellFormula(ws, rowTracker.totalRow, COL_PACKAGES, `SUM(${colLetter(COL_PACKAGES)}${dataStartExcelRow}:${colLetter(COL_PACKAGES)}${dataEndExcelRow})`);
  // Sum for DESCONTOS
  setCellFormula(ws, rowTracker.totalRow, COL_DISCOUNTS, `SUM(${colLetter(COL_DISCOUNTS)}${dataStartExcelRow}:${colLetter(COL_DISCOUNTS)}${dataEndExcelRow})`);
  // Sum for ADICIONAL
  setCellFormula(ws, rowTracker.totalRow, COL_ADDITIONAL, `SUM(${colLetter(COL_ADDITIONAL)}${dataStartExcelRow}:${colLetter(COL_ADDITIONAL)}${dataEndExcelRow})`);
  // Sum for TOTAL GERAL
  setCellFormula(ws, rowTracker.totalRow, COL_TOTAL_GERAL, `SUM(${colLetter(COL_TOTAL_GERAL)}${dataStartExcelRow}:${colLetter(COL_TOTAL_GERAL)}${dataEndExcelRow})`);
  // Sum for each date column
  for (let c = COL_DATES_START; c < COL_TOTAL; c++) {
    setCellFormula(ws, rowTracker.totalRow, c, `SUM(${colLetter(c)}${dataStartExcelRow}:${colLetter(c)}${dataEndExcelRow})`);
  }
  // Sum for TOTAL column
  setCellFormula(ws, rowTracker.totalRow, COL_TOTAL, `SUM(${colLetter(COL_TOTAL)}${dataStartExcelRow}:${colLetter(COL_TOTAL)}${dataEndExcelRow})`);

  // Min package rows - add formulas
  for (let r = rowTracker.minDataStartRow; r <= rowTracker.minDataEndRow; r++) {
    const excelRow = r + 1;
    const dateStartCol = colLetter(COL_DATES_START);
    const dateEndCol = colLetter(COL_TOTAL - 1);
    setCellFormula(ws, r, COL_TOTAL, `SUM(${dateStartCol}${excelRow}:${dateEndCol}${excelRow})`);
    setCellFormula(ws, r, COL_PACKAGES, `${colLetter(COL_TOTAL)}${excelRow}`);
    const packagesCell = `${colLetter(COL_PACKAGES)}${excelRow}`;
    const valueCell = `${colLetter(COL_VALUE)}${excelRow}`;
    const discountsCell = `${colLetter(COL_DISCOUNTS)}${excelRow}`;
    const additionalCell = `${colLetter(COL_ADDITIONAL)}${excelRow}`;
    setCellFormula(ws, r, COL_TOTAL_GERAL, `IF(${valueCell}=0,0,(${packagesCell}*${valueCell})-IF(${discountsCell}="",0,${discountsCell})+IF(${additionalCell}="",0,${additionalCell}))`);
  }

  // Min package TOTAL row formulas
  const minTotalExcelRow = rowTracker.minTotalRow + 1;
  const minDataStartExcelRow = rowTracker.minDataStartRow + 1;
  const minDataEndExcelRow = rowTracker.minDataEndRow + 1;
  
  setCellFormula(ws, rowTracker.minTotalRow, COL_PACKAGES, `SUM(${colLetter(COL_PACKAGES)}${minDataStartExcelRow}:${colLetter(COL_PACKAGES)}${minDataEndExcelRow})`);
  setCellFormula(ws, rowTracker.minTotalRow, COL_DISCOUNTS, `SUM(${colLetter(COL_DISCOUNTS)}${minDataStartExcelRow}:${colLetter(COL_DISCOUNTS)}${minDataEndExcelRow})`);
  setCellFormula(ws, rowTracker.minTotalRow, COL_ADDITIONAL, `SUM(${colLetter(COL_ADDITIONAL)}${minDataStartExcelRow}:${colLetter(COL_ADDITIONAL)}${minDataEndExcelRow})`);
  setCellFormula(ws, rowTracker.minTotalRow, COL_TOTAL_GERAL, `SUM(${colLetter(COL_TOTAL_GERAL)}${minDataStartExcelRow}:${colLetter(COL_TOTAL_GERAL)}${minDataEndExcelRow})`);
  for (let c = COL_DATES_START; c < COL_TOTAL; c++) {
    setCellFormula(ws, rowTracker.minTotalRow, c, `SUM(${colLetter(c)}${minDataStartExcelRow}:${colLetter(c)}${minDataEndExcelRow})`);
  }
  setCellFormula(ws, rowTracker.minTotalRow, COL_TOTAL, `SUM(${colLetter(COL_TOTAL)}${minDataStartExcelRow}:${colLetter(COL_TOTAL)}${minDataEndExcelRow})`);

  // Consolidado formulas - reference the TOTAL rows
  const consRow1 = rowTracker.consolidadoRows[0]; // Motoristas por pacotes
  const consRow2 = rowTracker.consolidadoRows[1]; // Min 60
  const consRow3 = rowTracker.consolidadoRows[2]; // Total Pacotes
  
  // Row 1: reference main TOTAL row
  for (let c = COL_DATES_START; c <= COL_TOTAL; c++) {
    setCellFormula(ws, consRow1, c, `${colLetter(c)}${totalExcelRow}`);
  }
  
  // Row 2: reference min TOTAL row
  for (let c = COL_DATES_START; c <= COL_TOTAL; c++) {
    setCellFormula(ws, consRow2, c, `${colLetter(c)}${minTotalExcelRow}`);
  }
  
  // Row 3: sum of row 1 and row 2
  const consRow1Excel = consRow1 + 1;
  const consRow2Excel = consRow2 + 1;
  for (let c = COL_DATES_START; c <= COL_TOTAL; c++) {
    setCellFormula(ws, consRow3, c, `${colLetter(c)}${consRow1Excel}+${colLetter(c)}${consRow2Excel}`);
  }

  // Resumo formulas
  const resumoRow1 = rowTracker.resumoRows[0]; // Motoristas por pacotes
  const resumoRow2 = rowTracker.resumoRows[1]; // Min 60
  const resumoRow3 = rowTracker.resumoRows[2]; // Custo por pacote
  
  // Row 1: Main drivers
  setCellFormula(ws, resumoRow1, 1, `${colLetter(COL_PACKAGES)}${totalExcelRow}`); // Qtd Pacotes
  setCellFormula(ws, resumoRow1, 2, `${colLetter(COL_TOTAL_GERAL)}${totalExcelRow}`); // Valor Total
  setCellFormula(ws, resumoRow1, 3, `IF(B${resumoRow1 + 1}=0,0,C${resumoRow1 + 1}/B${resumoRow1 + 1})`); // Média
  
  // Row 2: Min 60
  setCellFormula(ws, resumoRow2, 1, `${colLetter(COL_PACKAGES)}${minTotalExcelRow}`);
  setCellFormula(ws, resumoRow2, 2, `${colLetter(COL_TOTAL_GERAL)}${minTotalExcelRow}`);
  setCellFormula(ws, resumoRow2, 3, `IF(B${resumoRow2 + 1}=0,0,C${resumoRow2 + 1}/B${resumoRow2 + 1})`);
  
  // Row 3: Combined
  setCellFormula(ws, resumoRow3, 1, `B${resumoRow1 + 1}+B${resumoRow2 + 1}`);
  setCellFormula(ws, resumoRow3, 2, `C${resumoRow1 + 1}+C${resumoRow2 + 1}`);
  setCellFormula(ws, resumoRow3, 3, `IF(B${resumoRow3 + 1}=0,0,C${resumoRow3 + 1}/B${resumoRow3 + 1})`);

  // Set column widths
  const colWidths = [
    { wch: 35 },
    { wch: 10 },
    { wch: 18 },
    { wch: 28 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 16 },
    { wch: 25 },
    ...allDates.map(() => ({ wch: 8 })),
    { wch: 8 },
  ];
  ws["!cols"] = colWidths;

  // ══════════════ APPLY STYLES ══════════════

  // Section 1 title
  applyStyleToRow(ws, rowTracker.titleRow, 0, lastCol, {
    font: boldFontLg,
    fill: yellowFill,
    alignment: centerAlign,
    border: borderThin,
  });
  mergeRow(ws, rowTracker.titleRow, 0, lastCol);

  // "DADOS FINANCEIROS" row
  applyStyleToRow(ws, rowTracker.dataFinanceiraRow, 0, lastCol, {
    font: boldFont,
    alignment: leftAlign,
  });
  mergeRow(ws, rowTracker.dataFinanceiraRow, 0, lastCol);

  // Meta row
  applyStyleToRow(ws, rowTracker.metaRow, 0, lastCol, {
    font: { bold: true, sz: 10 },
    alignment: leftAlign,
  });

  // Headers row
  applyStyleToRow(ws, rowTracker.headerRow, 0, lastCol, {
    font: boldFont,
    fill: yellowFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // Data rows
  for (let r = rowTracker.dataStartRow; r <= rowTracker.dataEndRow; r++) {
    applyStyleToRow(ws, r, 0, 0, { font: { sz: 11 }, alignment: leftAlign, border: borderThin });
    for (let c = 1; c <= lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { font: { sz: 11 }, alignment: centerAlign, border: borderThin };
    }
  }

  // TOTAL row
  applyStyleToRow(ws, rowTracker.totalRow, 0, lastCol, {
    font: boldFont,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // Section 2 styles
  applyStyleToRow(ws, rowTracker.minTitleRow, 0, lastCol, {
    font: boldFontLg,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });
  mergeRow(ws, rowTracker.minTitleRow, 0, lastCol);

  applyStyleToRow(ws, rowTracker.minDataFinRow, 0, lastCol, {
    font: boldFont,
    alignment: leftAlign,
  });
  mergeRow(ws, rowTracker.minDataFinRow, 0, lastCol);

  applyStyleToRow(ws, rowTracker.minHeaderRow, 0, lastCol, {
    font: boldFont,
    fill: yellowFill,
    alignment: centerAlign,
    border: borderThin,
  });

  for (let r = rowTracker.minDataStartRow; r <= rowTracker.minDataEndRow; r++) {
    applyStyleToRow(ws, r, 0, 0, { font: { sz: 11 }, alignment: leftAlign, border: borderThin });
    for (let c = 1; c <= lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { font: { sz: 11 }, alignment: centerAlign, border: borderThin };
    }
  }

  applyStyleToRow(ws, rowTracker.minTotalRow, 0, lastCol, {
    font: boldFont,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // Section 3: Consolidated
  applyStyleToRow(ws, rowTracker.consolidadoHeaderRow, 0, lastCol, {
    font: boldFont,
    fill: grayFill,
    alignment: centerAlign,
    border: borderThin,
  });
  mergeRow(ws, rowTracker.consolidadoHeaderRow, 0, 8);

  for (const r of rowTracker.consolidadoRows) {
    applyStyleToRow(ws, r, 0, lastCol, {
      font: { sz: 11 },
      alignment: centerAlign,
      border: borderThin,
    });
    const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[labelAddr]) {
      ws[labelAddr].s = { ...ws[labelAddr].s, font: boldFont, alignment: leftAlign };
    }
  }

  const lastConsRow = rowTracker.consolidadoRows[rowTracker.consolidadoRows.length - 1];
  applyStyleToRow(ws, lastConsRow, 0, lastCol, {
    font: boldFont,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // Section 4: Resumo
  applyStyleToRow(ws, rowTracker.resumoHeaderRow, 0, 3, {
    font: boldFont,
    fill: grayFill,
    alignment: centerAlign,
    border: borderThin,
  });

  for (const r of rowTracker.resumoRows) {
    applyStyleToRow(ws, r, 0, 3, {
      font: { sz: 11 },
      alignment: centerAlign,
      border: borderThin,
    });
    const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[labelAddr]) {
      ws[labelAddr].s = { ...ws[labelAddr].s, font: boldFont, alignment: leftAlign };
    }
  }

  const lastResRow = rowTracker.resumoRows[rowTracker.resumoRows.length - 1];
  applyStyleToRow(ws, lastResRow, 0, 3, {
    font: boldFont,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // ══════════════ APPLY CURRENCY FORMATTING ══════════════
  // Currency columns: VALOR POR PACOTE (2), DESCONTOS (4), ADICIONAL (5), TOTAL GERAL (6)
  const currencyCols = [COL_VALUE, COL_DISCOUNTS, COL_ADDITIONAL, COL_TOTAL_GERAL];
  
  // Main data rows + total row
  for (const col of currencyCols) {
    applyCurrencyFormat(ws, col, rowTracker.dataStartRow, rowTracker.totalRow);
  }
  
  // Min package rows + total row
  for (const col of currencyCols) {
    applyCurrencyFormat(ws, col, rowTracker.minDataStartRow, rowTracker.minTotalRow);
  }
  
  // Resumo section: Valor Total (col 2) and Média Pacote (col 3)
  for (const r of rowTracker.resumoRows) {
    applyCurrencyFormat(ws, 2, r, r);
    applyCurrencyFormat(ws, 3, r, r);
  }

  // ══════════════ CREATE WORKBOOK ══════════════
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Folha de Pagamento");

  // ══════════════ CREATE INDIVIDUAL DRIVER SHEETS ══════════════
  const allDrivers = [...data, ...minPkgPayrollData.filter(mp => !data.some(d => d.driver.id === mp.driver.id))];
  
  allDrivers.forEach((d) => {
    const sheetName = sanitizeSheetName(d.driver.name || "Motorista");
    const driverWsData: (string | number)[][] = [];
    
    // Header section
    driverWsData.push(["RESUMO DO MOTORISTA"]);
    driverWsData.push([]);
    driverWsData.push(["Nome", d.driver.name]);
    driverWsData.push(["CPF", formatCpfBR(d.driver.cpf)]);
    const tbrVal = d.tbrValueUsed ?? 0;
    driverWsData.push(["Veículo", tbrVal <= 2.5 ? "MOTO" : "CARRO"]);
    driverWsData.push(["Chave PIX", d.driver.pixKey ?? ""]);
    driverWsData.push(["Valor por Pacote", tbrVal]);
    driverWsData.push([]);
    
    // Daily detail section
    driverWsData.push(["DETALHAMENTO DIÁRIO"]);
    driverWsData.push(["Data", "Pacotes", "Retornos", "Concluídos"]);
    
    const dailyStartRow = driverWsData.length;
    
    if (d.days.length > 0) {
      d.days.forEach((day) => {
        driverWsData.push([
          format(new Date(day.date + "T12:00:00"), "dd/MM/yyyy"),
          day.tbrCount,
          day.returns,
          0, // formula placeholder
        ]);
      });
    } else {
      // Empty rows for manual entry
      for (let i = 0; i < 15; i++) {
        driverWsData.push(["", 0, 0, 0]);
      }
    }
    
    const dailyEndRow = driverWsData.length - 1;
    
    // Total row
    driverWsData.push(["TOTAL", 0, 0, 0]);
    const totalDailyRow = driverWsData.length - 1;
    
    driverWsData.push([]);
    
    // Financial summary
    driverWsData.push(["RESUMO FINANCEIRO"]);
    driverWsData.push(["Total Pacotes Concluídos", 0]); // formula
    driverWsData.push(["Valor por Pacote", tbrVal]);
    driverWsData.push(["Subtotal (Pacotes × Valor)", 0]); // formula
    driverWsData.push(["Descontos (DNR)", d.dnrDiscount ?? 0]);
    driverWsData.push(["Adicional (Bônus + Reativo)", (d.bonus ?? 0) + (d.reativoTotal ?? 0)]);
    driverWsData.push(["TOTAL A PAGAR", 0]); // formula
    
    const driverWs = XLSX.utils.aoa_to_sheet(driverWsData);
    
    // Add formulas for daily rows
    for (let r = dailyStartRow; r <= dailyEndRow; r++) {
      const excelRow = r + 1;
      // Concluídos = Pacotes - Retornos
      setCellFormula(driverWs, r, 3, `IF(B${excelRow}=0,0,B${excelRow}-C${excelRow})`);
    }
    
    // Total row formulas
    const totalExcel = totalDailyRow + 1;
    const startExcel = dailyStartRow + 1;
    const endExcel = dailyEndRow + 1;
    setCellFormula(driverWs, totalDailyRow, 1, `SUM(B${startExcel}:B${endExcel})`);
    setCellFormula(driverWs, totalDailyRow, 2, `SUM(C${startExcel}:C${endExcel})`);
    setCellFormula(driverWs, totalDailyRow, 3, `SUM(D${startExcel}:D${endExcel})`);
    
    // Financial summary formulas
    const finStartRow = totalDailyRow + 3;
    setCellFormula(driverWs, finStartRow, 1, `D${totalExcel}`); // Total Pacotes = ref TOTAL Concluídos
    // Subtotal row
    setCellFormula(driverWs, finStartRow + 2, 1, `B${finStartRow + 1}*B${finStartRow + 2}`); // Pacotes * Valor
    // TOTAL A PAGAR
    const subtotalRow = finStartRow + 3;
    const discountsRow = finStartRow + 4;
    const additionalRow = finStartRow + 5;
    const totalPayRow = finStartRow + 6;
    setCellFormula(driverWs, totalPayRow - 1, 1, `B${subtotalRow}-B${discountsRow}+B${additionalRow}`);
    
    // Set column widths for driver sheet
    driverWs["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    
    // Apply styles
    // Title
    applyStyleToRow(driverWs, 0, 0, 3, {
      font: boldFontLg,
      fill: lightBlueFill,
      alignment: centerAlign,
      border: borderThin,
    });
    mergeRow(driverWs, 0, 0, 3);
    
    // Info rows
    for (let r = 2; r <= 6; r++) {
      applyStyleToRow(driverWs, r, 0, 1, {
        font: { sz: 11 },
        alignment: leftAlign,
        border: borderThin,
      });
      const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
      if (driverWs[labelAddr]) {
        driverWs[labelAddr].s = { ...driverWs[labelAddr].s, font: boldFont };
      }
    }
    
    // Daily header
    applyStyleToRow(driverWs, 8, 0, 3, {
      font: boldFont,
      fill: lightBlueFill,
      alignment: centerAlign,
      border: borderThin,
    });
    mergeRow(driverWs, 8, 0, 3);
    
    // Daily columns header
    applyStyleToRow(driverWs, 9, 0, 3, {
      font: boldFont,
      fill: yellowFill,
      alignment: centerAlign,
      border: borderThin,
    });
    
    // Daily data rows
    for (let r = dailyStartRow; r <= dailyEndRow; r++) {
      applyStyleToRow(driverWs, r, 0, 3, {
        font: { sz: 11 },
        alignment: centerAlign,
        border: borderThin,
      });
    }
    
    // Daily total row
    applyStyleToRow(driverWs, totalDailyRow, 0, 3, {
      font: boldFont,
      fill: greenFill,
      alignment: centerAlign,
      border: borderThin,
    });
    
    // Financial summary header
    applyStyleToRow(driverWs, totalDailyRow + 2, 0, 1, {
      font: boldFont,
      fill: lightBlueFill,
      alignment: centerAlign,
      border: borderThin,
    });
    mergeRow(driverWs, totalDailyRow + 2, 0, 1);
    
    // Financial rows
    for (let r = finStartRow; r <= totalPayRow - 1; r++) {
      applyStyleToRow(driverWs, r, 0, 1, {
        font: { sz: 11 },
        alignment: leftAlign,
        border: borderThin,
      });
      const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
      if (driverWs[labelAddr]) {
        driverWs[labelAddr].s = { ...driverWs[labelAddr].s, font: boldFont };
      }
    }
    
    // TOTAL A PAGAR row
    applyStyleToRow(driverWs, totalPayRow - 1, 0, 1, {
      font: boldFontLg,
      fill: greenFill,
      alignment: centerAlign,
      border: borderThin,
    });
    
    XLSX.utils.book_append_sheet(wb, driverWs, sheetName);
  });

  // ══════════════ SAVE FILE ══════════════
  const fileName = `folha_pagamento_${unitName.replace(/\s+/g, "_")}_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
