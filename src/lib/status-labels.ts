export const OPERATIONAL_PISO_REASONS = [
  "Removido do carregamento",
  "Carregamento resetado",
  "Carregamento cancelado",
];

const statusMap: Record<string, string> = {
  pending: "Pendente",
  loading: "Carregando",
  finished: "Finalizado",
  cancelled: "Cancelado",
  returned: "Retornado",
  waiting: "Aguardando",
  approved: "Aprovado",
  completed: "Concluído",
  open: "Aberto",
  analyzing: "Analisando",
  closed: "Fechado",
};

export const translateStatus = (status: string | null | undefined): string => {
  if (!status) return "—";
  return statusMap[status.toLowerCase()] ?? status;
};
