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

export function generatePayrollExcel(
  data: DriverPayrollData[],
  unitName: string,
  startDate: Date,
  endDate: Date,
) {
  const allDates = [
    ...new Set(data.flatMap((d) => d.days.map((day) => day.date))),
  ].sort();

  // Build header row
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

  // Build data rows
  const rows = data.map((d) => {
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
  });

  // Totals row
  const grandTotalCompleted = data.reduce((s, d) => s + d.totalCompleted, 0);
  const grandDescontos = data.reduce((s, d) => s + (d.dnrDiscount ?? 0), 0);
  const grandAdicional = data.reduce(
    (s, d) => s + (d.bonus ?? 0) + (d.reativoTotal ?? 0),
    0,
  );
  const grandTotalValue = data.reduce((s, d) => s + d.totalValue, 0);

  const totalsRow = [
    "TOTAL",
    "",
    "",
    grandTotalCompleted,
    grandDescontos > 0 ? `-${formatCurrencyBR(grandDescontos)}` : "",
    grandAdicional > 0 ? `+${formatCurrencyBR(grandAdicional)}` : "",
    formatCurrencyBR(grandTotalValue),
    "",
    "",
    ...allDates.map((date) => {
      const dayTotal = data.reduce((s, d) => {
        const day = d.days.find((day) => day.date === date);
        return s + (day ? (day.completed ?? day.tbrCount - day.returns) : 0);
      }, 0);
      return dayTotal || "";
    }),
    grandTotalCompleted,
  ];

  // Build worksheet data
  const wsData: (string | number)[][] = [];

  // Title rows
  wsData.push(["MOTORISTAS POR PACOTES"]);
  wsData.push([]);
  wsData.push([
    `Unidade: ${unitName}`,
    "",
    "",
    `Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`,
  ]);
  wsData.push([]);
  wsData.push(["DADOS FINANCEIROS"]);
  wsData.push(headers);

  // Data rows
  rows.forEach((row) => wsData.push(row));

  // Totals
  wsData.push(totalsRow);

  // Empty rows before summary
  wsData.push([]);
  wsData.push([]);

  // Summary block
  const avgPerPackage =
    grandTotalCompleted > 0 ? grandTotalValue / grandTotalCompleted : 0;
  wsData.push(["RESUMO", "Qtd. Pacotes", "Valor Total", "Média Pacote"]);
  wsData.push([
    "TOTAL",
    grandTotalCompleted,
    formatCurrencyBR(grandTotalValue),
    formatCurrencyBR(avgPerPackage),
  ]);

  // Create workbook
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = [
    { wch: 30 }, // NOME COMPLETO
    { wch: 10 }, // Veículo
    { wch: 18 }, // VALOR POR PACOTE
    { wch: 25 }, // TOTAL DE PACOTES
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
