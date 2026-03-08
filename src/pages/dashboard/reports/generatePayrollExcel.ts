import * as XLSX from "xlsx";
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

  // Also gather dates from minPackageDrivers if they have payroll data
  const minDrivers = minPackageDrivers ?? [];

  // Fixed headers
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

  // ── Helper: build totals row for a dataset ──
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

  // ── Helper: daily totals array for consolidated block ──
  const getDailyTotals = (dataset: DriverPayrollData[]) =>
    allDates.map((date) =>
      dataset.reduce((s, d) => {
        const day = d.days.find((day) => day.date === date);
        return s + (day ? (day.completed ?? day.tbrCount - day.returns) : 0);
      }, 0),
    );

  // ── Build minPackage DriverPayrollData entries (empty if no rides) ──
  const minPkgPayrollData: DriverPayrollData[] = minDrivers.map((mp) => {
    // Check if this driver already exists in main data
    const existing = data.find((d) => d.driver.id === mp.driverId);
    if (existing) return existing;
    // Empty driver entry
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

  // ══════════════ BUILD WORKSHEET ══════════════
  const wsData: (string | number)[][] = [];

  // ── SECTION 1: HEADER ──
  wsData.push(["MOTORISTAS FIXOS POR PACOTES"]);
  wsData.push([]);
  wsData.push(["DADOS FINANCEIROS"]);
  wsData.push([
    `Unidade: ${unitName}`,
    "",
    "",
    `Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`,
    "",
    "",
    `Gerado por: ${generatedBy ?? "Sistema"}`,
  ]);
  wsData.push(headers);

  // ── SECTION 1: MAIN DRIVER ROWS ──
  data.forEach((d) => wsData.push(buildDriverRow(d)));

  // ── SECTION 1: TOTALS ──
  wsData.push(buildTotalsRow(data, "TOTAL"));

  // ── SPACE ──
  wsData.push([]);
  wsData.push([]);

  // ── SECTION 2: MINIMUM PACKAGES DRIVERS ──
  if (minPkgPayrollData.length > 0) {
    wsData.push(["MOTORISTAS - MÍNIMO DE 60 (SESSENTA) PACOTES"]);
    wsData.push(["DADOS FINANCEIROS"]);
    wsData.push(headers);

    minPkgPayrollData.forEach((d) => wsData.push(buildDriverRow(d)));
    wsData.push(buildTotalsRow(minPkgPayrollData, "TOTAL"));

    wsData.push([]);
    wsData.push([]);
  }

  // ── SECTION 3: CONSOLIDATED BLOCK ──
  const mainDailyTotals = getDailyTotals(data);
  const minDailyTotals = getDailyTotals(minPkgPayrollData);
  const mainTotal = data.reduce((s, d) => s + d.totalCompleted, 0);
  const minTotal = minPkgPayrollData.reduce((s, d) => s + d.totalCompleted, 0);

  // Header for consolidated
  wsData.push(["CONSOLIDADO", "", "", "", "", "", "", "", "", ...dateHeaders, "TOTAL"]);

  wsData.push([
    "MOTORISTAS POR PACOTES",
    "", "", "", "", "", "", "", "",
    ...mainDailyTotals.map((v) => v || ""),
    mainTotal,
  ]);

  if (minPkgPayrollData.length > 0) {
    wsData.push([
      "MOTORISTAS - MÍNIMO DE 60 PACOTES",
      "", "", "", "", "", "", "", "",
      ...minDailyTotals.map((v) => v || ""),
      minTotal,
    ]);
  }

  const combinedDailyTotals = allDates.map((_, i) => mainDailyTotals[i] + minDailyTotals[i]);
  const combinedTotal = mainTotal + minTotal;

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

  wsData.push(["RESUMO", "Qtd. Pacotes Entregues", "Valor Total", "Média Pacote"]);
  wsData.push([
    "MOTORISTAS POR PACOTES",
    mainTotal,
    formatCurrencyBR(mainTotalValue),
    formatCurrencyBR(mainAvg),
  ]);
  if (minPkgPayrollData.length > 0) {
    wsData.push([
      "MOTORISTAS - MÍNIMO DE 60 PACOTES",
      minTotal,
      formatCurrencyBR(minTotalValue),
      formatCurrencyBR(minAvg),
    ]);
  }
  wsData.push([
    "CUSTO POR PACOTE",
    grandTotalCompleted,
    formatCurrencyBR(grandTotalValue),
    formatCurrencyBR(avgPerPackage),
  ]);

  // ══════════════ CREATE WORKBOOK ══════════════
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = [
    { wch: 35 }, // NOME COMPLETO
    { wch: 10 }, // Veículo
    { wch: 18 }, // VALOR POR PACOTE
    { wch: 28 }, // TOTAL DE PACOTES
    { wch: 15 }, // DESCONTOS
    { wch: 15 }, // ADICIONAL
    { wch: 18 }, // TOTAL GERAL
    { wch: 16 }, // CPF
    { wch: 25 }, // CHAVE PIX
    ...allDates.map(() => ({ wch: 8 })),
    { wch: 8 }, // TOTAL
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Folha de Pagamento");

  const fileName = `folha_pagamento_${unitName.replace(/\s+/g, "_")}_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
