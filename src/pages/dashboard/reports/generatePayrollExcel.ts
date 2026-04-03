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
const orangeFill = { fgColor: { rgb: "FFA500" } };
const redLightFill = { fgColor: { rgb: "FFC7CE" } };
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

function mergeRow(
  ws: XLSX.WorkSheet,
  row: number,
  colStart: number,
  colEnd: number,
) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: row, c: colStart }, e: { r: row, c: colEnd } });
}

function setCellFormula(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  formula: string,
  style?: Record<string, unknown>,
) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  ws[addr] = { t: "n", f: formula };
  if (style) ws[addr].s = style;
}

function applyCurrencyFormat(
  ws: XLSX.WorkSheet,
  col: number,
  rowStart: number,
  rowEnd: number,
) {
  const currencyFmt = '"R$" #,##0.00';
  for (let r = rowStart; r <= rowEnd; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: col });
    if (ws[addr]) {
      ws[addr].z = currencyFmt;
      ws[addr].s = { ...(ws[addr].s || {}), numFmt: currencyFmt };
    }
  }
}

function colLetter(col: number): string {
  let result = "";
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

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
  amazonPackages?: Record<string, number>,
) {
  const allDates = [
    ...new Set(data.flatMap((d) => d.days.map((day) => day.date))),
  ].sort();

  const minDrivers = minPackageDrivers ?? [];

  const dateHeaders = allDates.map((d) =>
    format(new Date(d + "T12:00:00"), "dd/MM"),
  );
  
  const headers = [
    "NOME COMPLETO",
    "CPF",
    "Veículo",
    ...dateHeaders,
    "TOTAL",
    "VALOR POR PACOTE",
    "ADICIONAL",
    "DESCONTOS",
    "TOTAL GERAL",
    "CHAVE PIX",
  ];
  
  const totalCols = headers.length;
  const lastCol = totalCols - 1;
  const numDates = allDates.length;

  const COL_NAME = 0;
  const COL_CPF = 1;
  const COL_VEHICLE = 2;
  const COL_DATES_START = 3;
  const COL_TOTAL = COL_DATES_START + numDates;
  const COL_VALUE = COL_TOTAL + 1;
  const COL_ADDITIONAL = COL_TOTAL + 2;
  const COL_DISCOUNTS = COL_TOTAL + 3;
  const COL_TOTAL_GERAL = COL_TOTAL + 4;
  const COL_PIX = COL_TOTAL + 5;
  const COL_PACKAGES = COL_TOTAL; // Alias para compatibilidade com fórmulas existentes

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

  // ── Sort data alphabetically ──
  const sortedData = [...data].sort((a, b) => a.driver.name.localeCompare(b.driver.name));

  // ══════════════ BUILD MAIN WORKSHEET DATA ══════════════
  const wsData: (string | number)[][] = [];

  const rowTracker = {
    titleRow: 0,
    dataFinanceiraRow: 2,
    metaRow: 3,
    headerRow: 6,
    dataStartRow: 7,
    dataEndRow: 0,
    totalRow: 0,
    minTitleRow: -1,
    minDataFinRow: -1,
    minHeaderRow: -1,
    minDataStartRow: -1,
    minDataEndRow: -1,
    minTotalRow: -1,
    consolidadoHeaderRow: -1,
    consolidadoRows: [] as number[],
    totalPacotesAmazonRow: -1,
    diferencaRow: -1,
    resumoHeaderRow: -1,
    resumoRows: [] as number[],
    adicionaisHeaderRow: -1,
    adicionaisRows: [] as number[],
    adicionaisTotalRow: -1,
  };

  // ── SECTION 1: HEADER ──
  wsData.push(["MOTORISTAS FIXOS POR PACOTES"]); // row 0
  wsData.push([]); // row 1
  wsData.push(["DADOS FINANCEIROS"]); // row 2
  wsData.push([`Unidade: ${unitName}`]); // row 3
  wsData.push([`Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`]); // row 4
  wsData.push([`Gerado por: ${generatedBy ?? "Sistema"}`]); // row 5
  wsData.push(headers); // row 6

  // ── SECTION 1: MAIN DRIVER ROWS ──
  sortedData.forEach((d) => {
    const tbrVal = d.tbrValueUsed ?? 0;
    const vehicleType = tbrVal <= 2.5 ? "MOTO" : "CARRO";
    const descontos = d.dnrDiscount ?? 0;
    const adicional = (d.bonus ?? 0) + (d.reativoTotal ?? 0);

    const dailyValues = allDates.map((date) => {
      const day = d.days.find((day) => day.date === date);
      if (!day) return "";
      
      // If minPkgDifference is present, it means this day SHOULD be shown in Table 1
      if (day.minPkgApplied && !day.minPkgDifference) return "";
      
      return day.completed ?? day.tbrCount - day.returns;
    });

    wsData.push([
      d.driver.name,
      d.driver.cpf || "",
      vehicleType,
      ...dailyValues,
      0, // COL_TOTAL
      tbrVal, // COL_VALUE
      adicional > 0 ? adicional : "", // COL_ADDITIONAL
      descontos > 0 ? descontos : "", // COL_DISCOUNTS
      0, // COL_TOTAL_GERAL
      d.driver.pixKey ?? "", // COL_PIX
    ]);
  });
  rowTracker.dataEndRow = wsData.length - 1;

  // ── SECTION 1: TOTALS ROW ──
  wsData.push([
    "TOTAL",
    "",
    "",
    ...allDates.map(() => 0),
    0, // COL_TOTAL
    "", // COL_VALUE
    0, // COL_ADDITIONAL
    0, // COL_DISCOUNTS
    0, // COL_TOTAL_GERAL
    "", // COL_PIX
  ]);
  rowTracker.totalRow = wsData.length - 1;

  const emptyColsEndTable1 = Array(5).fill("");

  // Total Pacotes Amazon (Laranja)
  rowTracker.totalPacotesAmazonRow = wsData.length;
  wsData.push([
    "Total Pacotes Amazon",
    "",
    "",
    ...allDates.map((date) => amazonPackages?.[date] ?? ""),
    "",
    ...emptyColsEndTable1
  ]);

  // Diferença (Rosa)
  rowTracker.diferencaRow = wsData.length;
  wsData.push([
    "Diferença",
    "",
    "",
    ...allDates.map(() => 0),
    0,
    ...emptyColsEndTable1
  ]);

  wsData.push([]);

  // ── SECTION 2: MINIMUM PACKAGES — repeat ALL main drivers + 10 blank rows ──
  rowTracker.minTitleRow = wsData.length;
  wsData.push(["MOTORISTAS - PACOTES MÍNIMO CONFIGURADOS"]);

  rowTracker.minDataFinRow = wsData.length;
  wsData.push(["DADOS FINANCEIROS"]);

  rowTracker.minHeaderRow = wsData.length;
  wsData.push(headers);

  rowTracker.minDataStartRow = wsData.length;

  // Repeat ALL drivers from the main table with their info but only triggered minimums
  sortedData.forEach((d) => {
    const tbrVal = d.tbrValueUsed ?? 0;
    const vehicleType = tbrVal <= 2.5 ? "MOTO" : "CARRO";
    
    const minPkgValues = allDates.map((date) => {
      const day = d.days.find((day) => day.date === date);
      if (day?.minPkgDifference) return day.minPkgDifference;
      if (day?.minPkgApplied && !day.minPkgDifference) return day.completed;
      return "";
    });

    wsData.push([
      d.driver.name,
      d.driver.cpf || "",
      vehicleType,
      ...minPkgValues,
      0, // COL_TOTAL formula placeholder
      tbrVal, // COL_VALUE
      "", // COL_ADDITIONAL
      "", // COL_DISCOUNTS
      0, // COL_TOTAL_GERAL
      d.driver.pixKey ?? "", // COL_PIX
    ]);
  });

  // Add 10 blank rows for manual additions
  for (let i = 0; i < 10; i++) {
    wsData.push([
      "",
      "",
      "",
      ...allDates.map(() => ""),
      0,
      0,
      "",
      "",
      0,
      "",
    ]);
  }
  rowTracker.minDataEndRow = wsData.length - 1;

  // Min packages total row
  wsData.push([
    "TOTAL",
    "",
    "",
    ...allDates.map(() => 0),
    0, // COL_TOTAL
    "", // COL_VALUE (empty)
    0, // COL_ADDITIONAL
    0, // COL_DISCOUNTS
    0, // COL_TOTAL_GERAL
    "", // COL_PIX
  ]);
  rowTracker.minTotalRow = wsData.length - 1;

  wsData.push([]);
  wsData.push([]);

  // ── SECTION 3: CONSOLIDATED BLOCK ──
  const emptyColsEndConsolidado = Array(5).fill("");
  
  rowTracker.consolidadoHeaderRow = wsData.length;
  wsData.push([
    "CONSOLIDADO",
    "",
    "",
    ...dateHeaders,
    "TOTAL",
    ...emptyColsEndConsolidado
  ]);

  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "MOTORISTAS POR PACOTES",
    "",
    "",
    ...allDates.map(() => 0),
    0,
    ...emptyColsEndConsolidado
  ]);

  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "MOTORISTAS - PACOTES MÍNIMO CONFIGURADOS",
    "",
    "",
    ...allDates.map(() => 0),
    0,
    ...emptyColsEndConsolidado
  ]);

  // Sections 3: Total Pacotes calculation remains, but Amazon and Difference moved up
  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "Total Pacotes",
    "",
    "",
    ...allDates.map(() => 0),
    0,
    ...emptyColsEndConsolidado
  ]);

  wsData.push([]);
  wsData.push([]);

  // ── SECTION 4: EXPANDED SUMMARY ──
  wsData.push([
    "RESUMO",
    "Qtd. Pacotes Entregues",
    "Valor Total",
    "Média Pacote",
  ]);

  rowTracker.resumoRows.push(wsData.length);
  wsData.push(["MOTORISTAS POR PACOTES", 0, 0, 0]);

  rowTracker.resumoRows.push(wsData.length);
  wsData.push(["MOTORISTAS - PACOTES MÍNIMO CONFIGURADOS", 0, 0, 0]);

  rowTracker.resumoRows.push(wsData.length);
  wsData.push(["CUSTO POR PACOTE", 0, 0, 0]);

  wsData.push([]);
  wsData.push([]);

  // ── SECTION 5: EXTRATO DE ADICIONAIS ──
  const allAdditionals = sortedData
    .flatMap((d) => d.additionalEntries || [])
    .sort(
      (a, b) =>
        new Date(a.date.split("T")[0] + "T12:00:00").getTime() -
        new Date(b.date.split("T")[0] + "T12:00:00").getTime(),
    );

  if (allAdditionals.length > 0) {
    rowTracker.adicionaisHeaderRow = wsData.length;
    wsData.push(["* EXTRATO DE ADICIONAIS (BÔNUS E REATIVOS)"]);
    wsData.push(["Data", "Motorista", "Descrição", "Valor"]);

    allAdditionals.forEach((add) => {
      rowTracker.adicionaisRows.push(wsData.length);
      wsData.push([
        format(new Date(add.date.split("T")[0] + "T12:00:00"), "dd/MM/yyyy"),
        add.driverName,
        add.description,
        add.value,
      ]);
    });

    rowTracker.adicionaisTotalRow = wsData.length;
    wsData.push([
      "TOTAL DE ADICIONAIS",
      "",
      "",
      allAdditionals.reduce((sum, a) => sum + a.value, 0),
    ]);
  }

  // ══════════════ CREATE WORKSHEET ══════════════
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ══════════════ ADD FORMULAS ══════════════

  // Main data rows
  for (let r = rowTracker.dataStartRow; r <= rowTracker.dataEndRow; r++) {
    const excelRow = r + 1;
    const dateStartCol = colLetter(COL_DATES_START);
    const dateEndCol = colLetter(COL_TOTAL - 1);
    setCellFormula(
      ws,
      r,
      COL_TOTAL,
      `SUM(${dateStartCol}${excelRow}:${dateEndCol}${excelRow})`,
    );
    const packagesCell = `${colLetter(COL_PACKAGES)}${excelRow}`;
    const valueCell = `${colLetter(COL_VALUE)}${excelRow}`;
    const discountsCell = `${colLetter(COL_DISCOUNTS)}${excelRow}`;
    const additionalCell = `${colLetter(COL_ADDITIONAL)}${excelRow}`;
    setCellFormula(
      ws,
      r,
      COL_TOTAL_GERAL,
      `(${packagesCell}*${valueCell})-IF(${discountsCell}="",0,${discountsCell})+IF(${additionalCell}="",0,${additionalCell})`,
    );
  }

  // Main TOTAL row formulas
  const totalExcelRow = rowTracker.totalRow + 1;
  const dataStartExcelRow = rowTracker.dataStartRow + 1;
  const dataEndExcelRow = rowTracker.dataEndRow + 1;

  setCellFormula(
    ws,
    rowTracker.totalRow,
    COL_PACKAGES,
    `SUM(${colLetter(COL_PACKAGES)}${dataStartExcelRow}:${colLetter(COL_PACKAGES)}${dataEndExcelRow})`,
  );
  setCellFormula(
    ws,
    rowTracker.totalRow,
    COL_DISCOUNTS,
    `SUM(${colLetter(COL_DISCOUNTS)}${dataStartExcelRow}:${colLetter(COL_DISCOUNTS)}${dataEndExcelRow})`,
  );
  setCellFormula(
    ws,
    rowTracker.totalRow,
    COL_ADDITIONAL,
    `SUM(${colLetter(COL_ADDITIONAL)}${dataStartExcelRow}:${colLetter(COL_ADDITIONAL)}${dataEndExcelRow})`,
  );
  setCellFormula(
    ws,
    rowTracker.totalRow,
    COL_TOTAL_GERAL,
    `SUM(${colLetter(COL_TOTAL_GERAL)}${dataStartExcelRow}:${colLetter(COL_TOTAL_GERAL)}${dataEndExcelRow})`,
  );
  for (let c = COL_DATES_START; c < COL_TOTAL; c++) {
    setCellFormula(
      ws,
      rowTracker.totalRow,
      c,
      `SUM(${colLetter(c)}${dataStartExcelRow}:${colLetter(c)}${dataEndExcelRow})`,
    );
  }
  setCellFormula(
    ws,
    rowTracker.totalRow,
    COL_TOTAL,
    `SUM(${colLetter(COL_TOTAL)}${dataStartExcelRow}:${colLetter(COL_TOTAL)}${dataEndExcelRow})`,
  );

  // Min package rows formulas
  for (let r = rowTracker.minDataStartRow; r <= rowTracker.minDataEndRow; r++) {
    const excelRow = r + 1;
    const dateStartCol = colLetter(COL_DATES_START);
    const dateEndCol = colLetter(COL_TOTAL - 1);
    setCellFormula(
      ws,
      r,
      COL_TOTAL,
      `SUM(${dateStartCol}${excelRow}:${dateEndCol}${excelRow})`,
    );
    const packagesCell = `${colLetter(COL_PACKAGES)}${excelRow}`;
    const valueCell = `${colLetter(COL_VALUE)}${excelRow}`;
    const discountsCell = `${colLetter(COL_DISCOUNTS)}${excelRow}`;
    const additionalCell = `${colLetter(COL_ADDITIONAL)}${excelRow}`;
    setCellFormula(
      ws,
      r,
      COL_TOTAL_GERAL,
      `IF(${valueCell}=0,0,(${packagesCell}*${valueCell})-IF(${discountsCell}="",0,${discountsCell})+IF(${additionalCell}="",0,${additionalCell}))`,
    );
  }

  // Min package TOTAL row formulas
  const minTotalExcelRow = rowTracker.minTotalRow + 1;
  const minDataStartExcelRow = rowTracker.minDataStartRow + 1;
  const minDataEndExcelRow = rowTracker.minDataEndRow + 1;

  setCellFormula(
    ws,
    rowTracker.minTotalRow,
    COL_PACKAGES,
    `SUM(${colLetter(COL_PACKAGES)}${minDataStartExcelRow}:${colLetter(COL_PACKAGES)}${minDataEndExcelRow})`,
  );
  setCellFormula(
    ws,
    rowTracker.minTotalRow,
    COL_DISCOUNTS,
    `SUM(${colLetter(COL_DISCOUNTS)}${minDataStartExcelRow}:${colLetter(COL_DISCOUNTS)}${minDataEndExcelRow})`,
  );
  setCellFormula(
    ws,
    rowTracker.minTotalRow,
    COL_ADDITIONAL,
    `SUM(${colLetter(COL_ADDITIONAL)}${minDataStartExcelRow}:${colLetter(COL_ADDITIONAL)}${minDataEndExcelRow})`,
  );
  setCellFormula(
    ws,
    rowTracker.minTotalRow,
    COL_TOTAL_GERAL,
    `SUM(${colLetter(COL_TOTAL_GERAL)}${minDataStartExcelRow}:${colLetter(COL_TOTAL_GERAL)}${minDataEndExcelRow})`,
  );
  for (let c = COL_DATES_START; c < COL_TOTAL; c++) {
    setCellFormula(
      ws,
      rowTracker.minTotalRow,
      c,
      `SUM(${colLetter(c)}${minDataStartExcelRow}:${colLetter(c)}${minDataEndExcelRow})`,
    );
  }
  setCellFormula(
    ws,
    rowTracker.minTotalRow,
    COL_TOTAL,
    `SUM(${colLetter(COL_TOTAL)}${minDataStartExcelRow}:${colLetter(COL_TOTAL)}${minDataEndExcelRow})`,
  );

  // Consolidado formulas
  const consRow1 = rowTracker.consolidadoRows[0];
  const consRow2 = rowTracker.consolidadoRows[1];
  const consRow3 = rowTracker.consolidadoRows[2];

  for (let c = COL_DATES_START; c <= COL_TOTAL; c++) {
    setCellFormula(ws, consRow1, c, `${colLetter(c)}${totalExcelRow}`);
  }
  for (let c = COL_DATES_START; c <= COL_TOTAL; c++) {
    setCellFormula(ws, consRow2, c, `${colLetter(c)}${minTotalExcelRow}`);
  }
  const consRow1Excel = consRow1 + 1;
  const consRow2Excel = consRow2 + 1;
  const consRow3Excel = consRow3 + 1;
  for (let c = COL_DATES_START; c <= COL_TOTAL; c++) {
    setCellFormula(
      ws,
      consRow3,
      c,
      `${colLetter(c)}${consRow1Excel}+${colLetter(c)}${consRow2Excel}`,
    );
  }

  // Total Pacotes Amazon — blank (manual), no formulas needed
  // Diferença = Total Pacotes - Total Pacotes Amazon
  const amazonRow = rowTracker.totalPacotesAmazonRow;
  const diffRow = rowTracker.diferencaRow;
  const amazonExcel = amazonRow + 1;
  const diffExcel = diffRow + 1;
  for (let c = COL_DATES_START; c < COL_TOTAL; c++) {
    setCellFormula(
      ws,
      diffRow,
      c,
      `${colLetter(c)}${consRow3Excel}-IF(${colLetter(c)}${amazonExcel}="",0,${colLetter(c)}${amazonExcel})`,
    );
  }

  // Resumo formulas
  const resumoRow1 = rowTracker.resumoRows[0];
  const resumoRow2 = rowTracker.resumoRows[1];
  const resumoRow3 = rowTracker.resumoRows[2];

  setCellFormula(
    ws,
    resumoRow1,
    1,
    `${colLetter(COL_PACKAGES)}${totalExcelRow}`,
  );
  setCellFormula(
    ws,
    resumoRow1,
    2,
    `${colLetter(COL_TOTAL_GERAL)}${totalExcelRow}`,
  );
  setCellFormula(
    ws,
    resumoRow1,
    3,
    `IF(B${resumoRow1 + 1}=0,0,C${resumoRow1 + 1}/B${resumoRow1 + 1})`,
  );

  setCellFormula(
    ws,
    resumoRow2,
    1,
    `${colLetter(COL_PACKAGES)}${minTotalExcelRow}`,
  );
  setCellFormula(
    ws,
    resumoRow2,
    2,
    `${colLetter(COL_TOTAL_GERAL)}${minTotalExcelRow}`,
  );
  setCellFormula(
    ws,
    resumoRow2,
    3,
    `IF(B${resumoRow2 + 1}=0,0,C${resumoRow2 + 1}/B${resumoRow2 + 1})`,
  );

  setCellFormula(ws, resumoRow3, 1, `B${resumoRow1 + 1}+B${resumoRow2 + 1}`);
  setCellFormula(ws, resumoRow3, 2, `C${resumoRow1 + 1}+C${resumoRow2 + 1}`);
  setCellFormula(
    ws,
    resumoRow3,
    3,
    `IF(B${resumoRow3 + 1}=0,0,C${resumoRow3 + 1}/B${resumoRow3 + 1})`,
  );

  // Set column widths
  const colWidths = [
    { wch: 35 }, // NOME COMPLETO
    { wch: 15 }, // CPF
    { wch: 10 }, // Veículo
    ...allDates.map(() => ({ wch: 8 })), // Dates
    { wch: 10 }, // TOTAL
    { wch: 18 }, // VALOR POR PACOTE
    { wch: 15 }, // ADICIONAL
    { wch: 15 }, // DESCONTOS
    { wch: 18 }, // TOTAL GERAL
    { wch: 25 }, // CHAVE PIX
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

  applyStyleToRow(ws, rowTracker.dataFinanceiraRow, 0, lastCol, {
    font: boldFont,
    alignment: leftAlign,
  });
  mergeRow(ws, rowTracker.dataFinanceiraRow, 0, lastCol);

  for (let r = rowTracker.metaRow; r < rowTracker.headerRow; r++) {
    applyStyleToRow(ws, r, 0, lastCol, {
      font: { bold: true, sz: 10 },
      alignment: leftAlign,
    });
  }

  applyStyleToRow(ws, rowTracker.headerRow, 0, lastCol, {
    font: boldFont,
    fill: yellowFill,
    alignment: centerAlign,
    border: borderThin,
  });

  for (let r = rowTracker.dataStartRow; r <= rowTracker.dataEndRow; r++) {
    applyStyleToRow(ws, r, 0, 0, {
      font: { sz: 11 },
      alignment: leftAlign,
      border: borderThin,
    });
    for (let c = 1; c <= lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = {
        font: { sz: 11 },
        alignment: centerAlign,
        border: borderThin,
      };
    }
  }

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
    applyStyleToRow(ws, r, 0, 0, {
      font: { sz: 11 },
      alignment: leftAlign,
      border: borderThin,
    });
    for (let c = 1; c <= lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = {
        font: { sz: 11 },
        alignment: centerAlign,
        border: borderThin,
      };
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
  mergeRow(ws, rowTracker.consolidadoHeaderRow, 0, 1);

  for (const r of rowTracker.consolidadoRows) {
    applyStyleToRow(ws, r, 0, lastCol, {
      font: { sz: 11 },
      alignment: centerAlign,
      border: borderThin,
    });
    const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[labelAddr]) {
      ws[labelAddr].s = {
        ...ws[labelAddr].s,
        font: boldFont,
        alignment: leftAlign,
      };
    }
  }

  const lastConsRow =
    rowTracker.consolidadoRows[rowTracker.consolidadoRows.length - 1];
  applyStyleToRow(ws, lastConsRow, 0, lastCol, {
    font: boldFont,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // Total Pacotes Amazon row style
  applyStyleToRow(ws, amazonRow, 0, lastCol, {
    font: boldFont,
    fill: orangeFill,
    alignment: centerAlign,
    border: borderThin,
  });
  const amazonLabelAddr = XLSX.utils.encode_cell({ r: amazonRow, c: 0 });
  if (ws[amazonLabelAddr]) {
    ws[amazonLabelAddr].s = { ...ws[amazonLabelAddr].s, alignment: leftAlign };
  }

  // Diferença row style
  applyStyleToRow(ws, diffRow, 0, lastCol, {
    font: boldFont,
    fill: redLightFill,
    alignment: centerAlign,
    border: borderThin,
  });
  const diffLabelAddr = XLSX.utils.encode_cell({ r: diffRow, c: 0 });
  if (ws[diffLabelAddr]) {
    ws[diffLabelAddr].s = { ...ws[diffLabelAddr].s, alignment: leftAlign };
  }

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
      ws[labelAddr].s = {
        ...ws[labelAddr].s,
        font: boldFont,
        alignment: leftAlign,
      };
    }
  }

  const lastResRow = rowTracker.resumoRows[rowTracker.resumoRows.length - 1];
  applyStyleToRow(ws, lastResRow, 0, 3, {
    font: boldFont,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // Section 5: Adicionais styles
  if (rowTracker.adicionaisHeaderRow !== -1) {
    applyStyleToRow(ws, rowTracker.adicionaisHeaderRow, 0, 3, {
      font: boldFontLg,
      fill: { fgColor: { rgb: "008080" } }, // Teal
      alignment: centerAlign,
      border: borderThin,
    });
    const addr = XLSX.utils.encode_cell({
      r: rowTracker.adicionaisHeaderRow,
      c: 0,
    });
    if (ws[addr]) ws[addr].s.font.color = { rgb: "FFFFFF" };
    mergeRow(ws, rowTracker.adicionaisHeaderRow, 0, 3);

    applyStyleToRow(ws, rowTracker.adicionaisHeaderRow + 1, 0, 3, {
      font: boldFont,
      fill: grayFill,
      alignment: centerAlign,
      border: borderThin,
    });

    for (const r of rowTracker.adicionaisRows) {
      applyStyleToRow(ws, r, 0, 3, {
        font: { sz: 11 },
        alignment: leftAlign,
        border: borderThin,
      });
      const valAddr = XLSX.utils.encode_cell({ r, c: 3 });
      if (ws[valAddr])
        ws[valAddr].s = {
          ...ws[valAddr].s,
          font: { bold: true, color: { rgb: "16A34A" } },
          alignment: centerAlign,
        };
    }

    applyStyleToRow(ws, rowTracker.adicionaisTotalRow, 0, 3, {
      font: boldFont,
      fill: greenFill,
      alignment: centerAlign,
      border: borderThin,
    });
    mergeRow(ws, rowTracker.adicionaisTotalRow, 0, 2);
    const totalAddr = XLSX.utils.encode_cell({
      r: rowTracker.adicionaisTotalRow,
      c: 0,
    });
    if (ws[totalAddr])
      ws[totalAddr].s = {
        ...ws[totalAddr].s,
        alignment: { horizontal: "right", vertical: "center" },
      };
  }

  // ══════════════ APPLY CURRENCY FORMATTING ══════════════
  const currencyCols = [
    COL_VALUE,
    COL_DISCOUNTS,
    COL_ADDITIONAL,
    COL_TOTAL_GERAL,
  ];

  for (const col of currencyCols) {
    applyCurrencyFormat(ws, col, rowTracker.dataStartRow, rowTracker.totalRow);
  }
  for (const col of currencyCols) {
    applyCurrencyFormat(
      ws,
      col,
      rowTracker.minDataStartRow,
      rowTracker.minTotalRow,
    );
  }
  for (const r of rowTracker.resumoRows) {
    applyCurrencyFormat(ws, 2, r, r);
    applyCurrencyFormat(ws, 3, r, r);
  }

  if (rowTracker.adicionaisHeaderRow !== -1) {
    applyCurrencyFormat(
      ws,
      3,
      rowTracker.adicionaisRows[0],
      rowTracker.adicionaisTotalRow,
    );
  }

  // ══════════════ SUMMARY TABLE AT COLUMN Z ══════════════
  const COL_SUMMARY_START = 25; // Column Z (0-indexed)
  const COL_SUMMARY_NAME = COL_SUMMARY_START;
  const COL_SUMMARY_T1 = COL_SUMMARY_START + 1;
  const COL_SUMMARY_T2 = COL_SUMMARY_START + 2;
  const COL_SUMMARY_TOTAL = COL_SUMMARY_START + 3;

  // Title row (row 5, 0-indexed)
  const summaryTitleRow = 5;
  const summaryAddr0 = XLSX.utils.encode_cell({ r: summaryTitleRow, c: COL_SUMMARY_NAME });
  ws[summaryAddr0] = { v: "RESUMO DE PAGAMENTOS", t: "s" };
  ws[summaryAddr0].s = { font: boldFontLg, fill: lightBlueFill, alignment: centerAlign, border: borderThin };
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: summaryTitleRow, c: COL_SUMMARY_NAME }, e: { r: summaryTitleRow, c: COL_SUMMARY_TOTAL } });

  // Header row (row 6, 0-indexed)
  const summaryHeaderRow = 6;
  const summaryHeaders = ["Motorista", "Tabela 1", "Tabela 2", "Total"];
  summaryHeaders.forEach((h, i) => {
    const addr = XLSX.utils.encode_cell({ r: summaryHeaderRow, c: COL_SUMMARY_START + i });
    ws[addr] = { v: h, t: "s" };
    ws[addr].s = { font: boldFont, fill: yellowFill, alignment: centerAlign, border: borderThin };
  });

  // Data rows — one per sorted driver
  const summaryDataStartRow = 7;
  sortedData.forEach((d, idx) => {
    const r = summaryDataStartRow + idx;
    const excelRow = r + 1;

    // Name
    const nameAddr = XLSX.utils.encode_cell({ r, c: COL_SUMMARY_NAME });
    ws[nameAddr] = { v: d.driver.name, t: "s" };
    ws[nameAddr].s = { font: { sz: 11 }, alignment: leftAlign, border: borderThin };

    // Tabela 1 — reference TOTAL GERAL from main table for this driver
    const mainDataRow = rowTracker.dataStartRow + idx + 1; // Excel 1-indexed
    setCellFormula(ws, r, COL_SUMMARY_T1, `${colLetter(COL_TOTAL_GERAL)}${mainDataRow}`, {
      font: { sz: 11 }, alignment: centerAlign, border: borderThin,
    });

    // Tabela 2 — reference TOTAL GERAL from min packages table for this driver
    const minDataRow = rowTracker.minDataStartRow + idx + 1; // Excel 1-indexed
    setCellFormula(ws, r, COL_SUMMARY_T2, `${colLetter(COL_TOTAL_GERAL)}${minDataRow}`, {
      font: { sz: 11 }, alignment: centerAlign, border: borderThin,
    });

    // Total = T1 + T2
    const t1Cell = `${colLetter(COL_SUMMARY_T1)}${excelRow}`;
    const t2Cell = `${colLetter(COL_SUMMARY_T2)}${excelRow}`;
    setCellFormula(ws, r, COL_SUMMARY_TOTAL, `${t1Cell}+${t2Cell}`, {
      font: { sz: 11, bold: true }, alignment: centerAlign, border: borderThin,
    });
  });

  // Totals row
  const summaryTotalRow = summaryDataStartRow + sortedData.length;
  const summaryTotalExcel = summaryTotalRow + 1;
  const summaryStartExcel = summaryDataStartRow + 1;
  const summaryEndExcel = summaryTotalRow; // last data row in Excel 1-indexed

  const totalLabelAddr = XLSX.utils.encode_cell({ r: summaryTotalRow, c: COL_SUMMARY_NAME });
  ws[totalLabelAddr] = { v: "TOTAL", t: "s" };
  ws[totalLabelAddr].s = { font: boldFont, fill: greenFill, alignment: centerAlign, border: borderThin };

  [COL_SUMMARY_T1, COL_SUMMARY_T2, COL_SUMMARY_TOTAL].forEach((col) => {
    setCellFormula(
      ws,
      summaryTotalRow,
      col,
      `SUM(${colLetter(col)}${summaryStartExcel}:${colLetter(col)}${summaryEndExcel})`,
      { font: boldFont, fill: greenFill, alignment: centerAlign, border: borderThin },
    );
  });

  // Currency format for summary columns
  const currencyFmt = '"R$" #,##0.00';
  for (let r = summaryDataStartRow; r <= summaryTotalRow; r++) {
    for (const col of [COL_SUMMARY_T1, COL_SUMMARY_T2, COL_SUMMARY_TOTAL]) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      if (ws[addr]) {
        ws[addr].z = currencyFmt;
        ws[addr].s = { ...(ws[addr].s || {}), numFmt: currencyFmt };
      }
    }
  }

  // Set column widths for summary columns
  if (!ws["!cols"]) ws["!cols"] = colWidths;
  while (ws["!cols"].length <= COL_SUMMARY_TOTAL) {
    ws["!cols"].push({ wch: 8 });
  }
  ws["!cols"][COL_SUMMARY_NAME] = { wch: 35 };
  ws["!cols"][COL_SUMMARY_T1] = { wch: 18 };
  ws["!cols"][COL_SUMMARY_T2] = { wch: 18 };
  ws["!cols"][COL_SUMMARY_TOTAL] = { wch: 18 };

  // Update sheet range to include summary columns
  const lastSummaryRow = summaryTotalRow;
  const currentRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
  if (COL_SUMMARY_TOTAL > currentRange.e.c) currentRange.e.c = COL_SUMMARY_TOTAL;
  if (lastSummaryRow > currentRange.e.r) currentRange.e.r = lastSummaryRow;
  ws["!ref"] = XLSX.utils.encode_range(currentRange);

  // ══════════════ CREATE WORKBOOK ══════════════
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fechamento");

  // ══════════════ SAVE FILE ══════════════
  const fileName = `folha_pagamento_${unitName.replace(/\s+/g, "_")}_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
