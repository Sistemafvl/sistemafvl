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

  // ── Helper: build driver row ──
  const buildDriverRow = (d: DriverPayrollData) => {
    const tbrVal = d.tbrValueUsed ?? 0;
    const vehicleType = tbrVal <= 2.5 ? "MOTO" : "CARRO";
    const descontos = d.dnrDiscount ?? 0;
    const adicional = (d.bonus ?? 0) + (d.reativoTotal ?? 0);
    const totalGeral = d.totalValue;

    const dailyValues = allDates.map((date) => {
      const day = d.days.find((day) => day.date === date);
      if (!day) return "";
      return day.completed ?? day.tbrCount - day.returns;
    });

    const totalDays = dailyValues.reduce(
      (s: number, v) => s + (typeof v === "number" ? v : 0),
      0,
    );

    return [
      d.driver.name,
      vehicleType,
      formatCurrencyBR(tbrVal),
      d.totalCompleted,
      descontos > 0 ? `-${formatCurrencyBR(descontos)}` : "",
      adicional > 0 ? `+${formatCurrencyBR(adicional)}` : "",
      formatCurrencyBR(totalGeral),
      formatCpfBR(d.driver.cpf),
      d.driver.pixKey ?? "",
      ...dailyValues,
      totalDays,
    ];
  };

  const buildTotalsRow = (dataset: DriverPayrollData[], label = "TOTAL") => {
    const grandTotalCompleted = dataset.reduce((s, d) => s + d.totalCompleted, 0);
    const grandDescontos = dataset.reduce((s, d) => s + (d.dnrDiscount ?? 0), 0);
    const grandAdicional = dataset.reduce(
      (s, d) => s + (d.bonus ?? 0) + (d.reativoTotal ?? 0),
      0,
    );
    const grandTotalValue = dataset.reduce((s, d) => s + d.totalValue, 0);

    return [
      label,
      "",
      "",
      grandTotalCompleted,
      grandDescontos > 0 ? `-${formatCurrencyBR(grandDescontos)}` : "",
      grandAdicional > 0 ? `+${formatCurrencyBR(grandAdicional)}` : "",
      formatCurrencyBR(grandTotalValue),
      "",
      "",
      ...allDates.map((date) => {
        const dayTotal = dataset.reduce((s, d) => {
          const day = d.days.find((day) => day.date === date);
          return s + (day ? (day.completed ?? day.tbrCount - day.returns) : 0);
        }, 0);
        return dayTotal || "";
      }),
      grandTotalCompleted,
    ];
  };

  const getDailyTotals = (dataset: DriverPayrollData[]) =>
    allDates.map((date) =>
      dataset.reduce((s, d) => {
        const day = d.days.find((day) => day.date === date);
        return s + (day ? (day.completed ?? day.tbrCount - day.returns) : 0);
      }, 0),
    );

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

  // ══════════════ BUILD WORKSHEET DATA ══════════════
  const wsData: (string | number)[][] = [];

  // Track row indices for styling
  const rowTracker = {
    titleRow: 0,
    dataFinanceiraRow: 2,
    metaRow: 3,
    headerRow: 4,
    dataStartRow: 5,
    dataEndRow: 0, // computed later
    totalRow: 0,
    // Section 2
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

  // ── SECTION 1: MAIN DRIVER ROWS ──
  data.forEach((d) => wsData.push(buildDriverRow(d)));
  rowTracker.dataEndRow = wsData.length - 1;

  // ── SECTION 1: TOTALS ──
  wsData.push(buildTotalsRow(data, "TOTAL"));
  rowTracker.totalRow = wsData.length - 1;

  // ── SPACE ──
  wsData.push([]);
  wsData.push([]);

  // ── SECTION 2: MINIMUM PACKAGES DRIVERS ──
  if (minPkgPayrollData.length > 0) {
    rowTracker.minTitleRow = wsData.length;
    wsData.push(["MOTORISTAS - MÍNIMO DE 60 (SESSENTA) PACOTES"]);

    rowTracker.minDataFinRow = wsData.length;
    wsData.push(["DADOS FINANCEIROS"]);

    rowTracker.minHeaderRow = wsData.length;
    wsData.push(headers);

    rowTracker.minDataStartRow = wsData.length;
    minPkgPayrollData.forEach((d) => wsData.push(buildDriverRow(d)));
    rowTracker.minDataEndRow = wsData.length - 1;

    wsData.push(buildTotalsRow(minPkgPayrollData, "TOTAL"));
    rowTracker.minTotalRow = wsData.length - 1;

    wsData.push([]);
    wsData.push([]);
  }

  // ── SECTION 3: CONSOLIDATED BLOCK ──
  const mainDailyTotals = getDailyTotals(data);
  const minDailyTotals = getDailyTotals(minPkgPayrollData);
  const mainTotal = data.reduce((s, d) => s + d.totalCompleted, 0);
  const minTotal = minPkgPayrollData.reduce((s, d) => s + d.totalCompleted, 0);

  rowTracker.consolidadoHeaderRow = wsData.length;
  wsData.push(["CONSOLIDADO", "", "", "", "", "", "", "", "", ...dateHeaders, "TOTAL"]);

  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "MOTORISTAS POR PACOTES",
    "", "", "", "", "", "", "", "",
    ...mainDailyTotals.map((v) => v || ""),
    mainTotal,
  ]);

  if (minPkgPayrollData.length > 0) {
    rowTracker.consolidadoRows.push(wsData.length);
    wsData.push([
      "MOTORISTAS - MÍNIMO DE 60 PACOTES",
      "", "", "", "", "", "", "", "",
      ...minDailyTotals.map((v) => v || ""),
      minTotal,
    ]);
  }

  const combinedDailyTotals = allDates.map((_, i) => mainDailyTotals[i] + minDailyTotals[i]);
  const combinedTotal = mainTotal + minTotal;

  rowTracker.consolidadoRows.push(wsData.length);
  wsData.push([
    "Total Pacotes",
    "", "", "", "", "", "", "", "",
    ...combinedDailyTotals.map((v) => v || ""),
    combinedTotal,
  ]);

  // ── SPACE ──
  wsData.push([]);
  wsData.push([]);

  // ── SECTION 4: EXPANDED SUMMARY ──
  const mainTotalValue = data.reduce((s, d) => s + d.totalValue, 0);
  const minTotalValue = minPkgPayrollData.reduce((s, d) => s + d.totalValue, 0);
  const grandTotalValue = mainTotalValue + minTotalValue;
  const grandTotalCompleted = mainTotal + minTotal;
  const avgPerPackage = grandTotalCompleted > 0 ? grandTotalValue / grandTotalCompleted : 0;
  const mainAvg = mainTotal > 0 ? mainTotalValue / mainTotal : 0;
  const minAvg = minTotal > 0 ? minTotalValue / minTotal : 0;

  rowTracker.resumoHeaderRow = wsData.length;
  wsData.push(["RESUMO", "Qtd. Pacotes Entregues", "Valor Total", "Média Pacote"]);

  rowTracker.resumoRows.push(wsData.length);
  wsData.push([
    "MOTORISTAS POR PACOTES",
    mainTotal,
    formatCurrencyBR(mainTotalValue),
    formatCurrencyBR(mainAvg),
  ]);

  if (minPkgPayrollData.length > 0) {
    rowTracker.resumoRows.push(wsData.length);
    wsData.push([
      "MOTORISTAS - MÍNIMO DE 60 PACOTES",
      minTotal,
      formatCurrencyBR(minTotalValue),
      formatCurrencyBR(minAvg),
    ]);
  }

  rowTracker.resumoRows.push(wsData.length);
  wsData.push([
    "CUSTO POR PACOTE",
    grandTotalCompleted,
    formatCurrencyBR(grandTotalValue),
    formatCurrencyBR(avgPerPackage),
  ]);

  // ══════════════ CREATE WORKSHEET ══════════════
  const ws = XLSX.utils.aoa_to_sheet(wsData);

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

  // ── Section 1 title: yellow bg, bold, merge ──
  applyStyleToRow(ws, rowTracker.titleRow, 0, lastCol, {
    font: boldFontLg,
    fill: yellowFill,
    alignment: centerAlign,
    border: borderThin,
  });
  mergeRow(ws, rowTracker.titleRow, 0, lastCol);

  // ── "DADOS FINANCEIROS" row ──
  applyStyleToRow(ws, rowTracker.dataFinanceiraRow, 0, lastCol, {
    font: boldFont,
    alignment: leftAlign,
  });
  mergeRow(ws, rowTracker.dataFinanceiraRow, 0, lastCol);

  // ── Meta row (Unidade/Período/Gerado) ──
  applyStyleToRow(ws, rowTracker.metaRow, 0, lastCol, {
    font: { bold: true, sz: 10 },
    alignment: leftAlign,
  });

  // ── Headers row: yellow bg, bold, centered, borders ──
  applyStyleToRow(ws, rowTracker.headerRow, 0, lastCol, {
    font: boldFont,
    fill: yellowFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // ── Data rows: borders, centered for numeric cols ──
  for (let r = rowTracker.dataStartRow; r <= rowTracker.dataEndRow; r++) {
    applyStyleToRow(ws, r, 0, 0, { font: { sz: 11 }, alignment: leftAlign, border: borderThin });
    for (let c = 1; c <= lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { font: { sz: 11 }, alignment: centerAlign, border: borderThin };
    }
  }

  // ── TOTAL row: green bg, bold, borders ──
  applyStyleToRow(ws, rowTracker.totalRow, 0, lastCol, {
    font: boldFont,
    fill: greenFill,
    alignment: centerAlign,
    border: borderThin,
  });

  // ── Section 2 styles (if exists) ──
  if (rowTracker.minTitleRow >= 0) {
    // Title
    applyStyleToRow(ws, rowTracker.minTitleRow, 0, lastCol, {
      font: boldFontLg,
      fill: greenFill,
      alignment: centerAlign,
      border: borderThin,
    });
    mergeRow(ws, rowTracker.minTitleRow, 0, lastCol);

    // DADOS FINANCEIROS
    applyStyleToRow(ws, rowTracker.minDataFinRow, 0, lastCol, {
      font: boldFont,
      alignment: leftAlign,
    });
    mergeRow(ws, rowTracker.minDataFinRow, 0, lastCol);

    // Headers
    applyStyleToRow(ws, rowTracker.minHeaderRow, 0, lastCol, {
      font: boldFont,
      fill: yellowFill,
      alignment: centerAlign,
      border: borderThin,
    });

    // Data rows
    for (let r = rowTracker.minDataStartRow; r <= rowTracker.minDataEndRow; r++) {
      applyStyleToRow(ws, r, 0, 0, { font: { sz: 11 }, alignment: leftAlign, border: borderThin });
      for (let c = 1; c <= lastCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        ws[addr].s = { font: { sz: 11 }, alignment: centerAlign, border: borderThin };
      }
    }

    // Total
    applyStyleToRow(ws, rowTracker.minTotalRow, 0, lastCol, {
      font: boldFont,
      fill: greenFill,
      alignment: centerAlign,
      border: borderThin,
    });
  }

  // ── Section 3: Consolidated ──
  if (rowTracker.consolidadoHeaderRow >= 0) {
    applyStyleToRow(ws, rowTracker.consolidadoHeaderRow, 0, lastCol, {
      font: boldFont,
      fill: grayFill,
      alignment: centerAlign,
      border: borderThin,
    });
    // Merge "CONSOLIDADO" label across fixed columns
    mergeRow(ws, rowTracker.consolidadoHeaderRow, 0, 8);

    for (const r of rowTracker.consolidadoRows) {
      applyStyleToRow(ws, r, 0, lastCol, {
        font: { sz: 11 },
        alignment: centerAlign,
        border: borderThin,
      });
      // Bold the label column
      const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[labelAddr]) {
        ws[labelAddr].s = { ...ws[labelAddr].s, font: boldFont, alignment: leftAlign };
      }
    }

    // Last consolidated row (Total Pacotes) gets green
    const lastConsRow = rowTracker.consolidadoRows[rowTracker.consolidadoRows.length - 1];
    applyStyleToRow(ws, lastConsRow, 0, lastCol, {
      font: boldFont,
      fill: greenFill,
      alignment: centerAlign,
      border: borderThin,
    });
  }

  // ── Section 4: Resumo ──
  if (rowTracker.resumoHeaderRow >= 0) {
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
      // Bold label
      const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[labelAddr]) {
        ws[labelAddr].s = { ...ws[labelAddr].s, font: boldFont, alignment: leftAlign };
      }
    }

    // Last resumo row (CUSTO POR PACOTE) gets green
    const lastResRow = rowTracker.resumoRows[rowTracker.resumoRows.length - 1];
    applyStyleToRow(ws, lastResRow, 0, 3, {
      font: boldFont,
      fill: greenFill,
      alignment: centerAlign,
      border: borderThin,
    });
  }

  // ══════════════ CREATE WORKBOOK & SAVE ══════════════
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Folha de Pagamento");

  const fileName = `folha_pagamento_${unitName.replace(/\s+/g, "_")}_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
