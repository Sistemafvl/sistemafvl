-- Migration: Add latest fixes to system_updates

INSERT INTO public.system_updates (type, module, description) VALUES
  ('update', 'Motoristas Parceiros', 'Correção no filtro de pesquisa por CPF e correção de tela em branco ao clicar no ícone do motorista.'),
  ('update', 'Socorrendo (Transferência)', 'Correção do status "travado" (em conferência por outro) ao transferir pacotes para um motorista pendente.'),
  ('update', 'Relatórios Gerenciais', 'Adicionado extrato detalhado de adicionais (bônus e reativos) no final do PDF e da planilha Excel de espelho e fechamento.');
