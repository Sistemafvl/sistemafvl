-- Migration: Populate system_updates with historical development changes
-- This inserts the last 40 updates from development sessions in chronological order.
-- Run this in Supabase SQL Editor to populate the "Atualizações do Sistema" list.

-- Clean up any existing duplicates (optional, safe to run idempotently)
DELETE FROM public.system_updates
WHERE description IN (
  'Dashboard em tempo real: ouvintes Realtime para driver_rides, piso_entries, ps_entries e rto_entries',
  'InsucessoBalloon: tempo de atualização reduzido de 15s para 1s',
  'process_tbr_scan: adicionados TRIM e UPPER para evitar falhas por espaços/capitalização',
  'PSPage: PS agora fecha automaticamente o insucesso do TBR ao ser registrado',
  'Carregamento: adicionado card Aguardando (motoristas com status pending)',
  'Carregamento: contador DA S agora exclui motoristas cancelados',
  'Carregamento: ícone do card DA S alterado para avatar de motorista',
  'Carregamento: cards de Ciclos 1, 2 e 3 adicionados ao topo da página',
  'Carregamento: Realtime consolidado - atualização instantânea de bipes e programações',
  'Carregamento: proteção anti-conflito para evitar que dois conferentes iniciem o mesmo carregamento',
  'Carregamento: indicador visual mostrando quem está em conferência em cada card',
  'Carregamento: busca por TBR com campo de lupa persistente na página',
  'Carregamento: importação do usuário Users corrigida (erro de build resolvido)',
  'DashboardMetrics: otimização de queries substituindo fetchAllRowsWithIn por agregações',
  'MatrizOverview: redução de 60 por cento no payload de dados massivos',
  'Configurações: script SQL de otimização para índices e funções de custo',
  'Dashboard: refatoração de DashboardHome reduzindo requisições e payload',
  'Motoristas: carregamento sob demanda na página MotoristasParceiros',
  'Carregamento: drag and drop para reordenação de cards de motorista (gerente)',
  'Carregamento: botão de câmera removido dos cards e do modal maximizado',
  'Carregamento: lupa de busca por TBR adicionada ao modal maximizado',
  'Carregamento: botão CSV para exportar todos os TBRs bipados com motorista e status',
  'PS: modo de digitação livre - teclado agora exige Enter para buscar TBR',
  'PS: botão Sem Embalagem para registrar PS sem TBR identificável',
  'PS: lupa de busca por TBR adicionada ao filtro da tabela',
  'TBR scan: bloqueio corrigido para permitir re-carregamento de TBRs em insucesso',
  'TBR scan: mensagens de erro traduzidas para Português',
  'TBR scan: ao bipar no carregamento, fecha automaticamente o piso_entry (insucesso) do TBR'
);

-- Insert all updates in chronological order (oldest first, newest last)
INSERT INTO public.system_updates (type, module, description, published_at) VALUES
-- Março 07
('update', 'Atualizações', 'Histórico de atualizações do sistema limpo e reorganizado cronologicamente', '2026-03-07 20:00:00+00'),
('update', 'Carregamento', 'Menu renomeado: Conferência Carregamento simplificado para Carregamento', '2026-03-07 19:56:00+00'),
('update', 'Dashboard', 'Balão de insucessos agora conta todos os motivos pendentes, não apenas os operacionais', '2026-03-07 18:56:00+00'),

-- Março 11-12
('update', 'Dashboard', 'Dashboard em tempo real: ouvintes Realtime para driver_rides, piso_entries, ps_entries e rto_entries', '2026-03-11 20:00:00+00'),
('update', 'Insucessos', 'InsucessoBalloon: tempo de atualização reduzido de 15s para 1s', '2026-03-11 20:30:00+00'),
('update', 'Insucessos', 'process_tbr_scan: adicionados TRIM e UPPER para evitar falhas por espaços/capitalização', '2026-03-11 21:00:00+00'),
('update', 'PS', 'PSPage: PS agora fecha automaticamente o insucesso do TBR ao ser registrado', '2026-03-11 21:30:00+00'),

-- Março 13-14 — UI Carregamento
('create', 'Carregamento', 'Adicionado card Aguardando (motoristas com status pending) ao topo da página', '2026-03-13 22:00:00+00'),
('update', 'Carregamento', 'Contador DA S agora exclui motoristas cancelados e ícone alterado para avatar', '2026-03-13 22:15:00+00'),
('create', 'Carregamento', 'Cards de Ciclos 1, 2 e 3 adicionados ao topo da página de Carregamento', '2026-03-13 22:30:00+00'),
('update', 'Carregamento', 'Realtime consolidado — atualização instantânea de bipes e novas programações', '2026-03-14 00:30:00+00'),
('update', 'Carregamento', 'Proteção anti-conflito: bloqueia segundo conferente de iniciar carregamento já em andamento', '2026-03-14 01:00:00+00'),
('update', 'Carregamento', 'Indicador visual azul mostrando quem está em conferência em cada card de motorista', '2026-03-14 01:30:00+00'),

-- Março 14 — Custos e Otimização
('update', 'DashboardMetrics', 'Otimização de queries: substituição de fetchAllRowsWithIn por agregações eficientes', '2026-03-14 17:00:00+00'),
('update', 'MatrizOverview', 'Redução de 60% no payload de dados massivos de toda a franquia', '2026-03-14 17:30:00+00'),
('config', 'Banco de Dados', 'Script SQL de otimização criado para índices e funções de custo do sistema', '2026-03-14 18:00:00+00'),
('update', 'Dashboard', 'DashboardHome refatorado: menos requisições e payload mais enxuto', '2026-03-14 18:30:00+00'),
('update', 'Motoristas', 'MotoristasParceiros: carregamento sob demanda (lazy loading) implementado', '2026-03-14 19:00:00+00'),

-- Março 14 — Drag and Drop
('create', 'Carregamento', 'Drag and drop para reordenação de cards de motorista exclusivo para gerentes', '2026-03-14 20:00:00+00'),

-- Março 14 — TBR Scan Fix
('update', 'Insucessos', 'TBR scan: correção de bloqueio — TBRs em insucesso podem ser re-carregados normalmente', '2026-03-14 20:30:00+00'),
('update', 'Insucessos', 'TBR scan: mensagens de erro traduzidas para Português', '2026-03-14 20:35:00+00'),
('update', 'Carregamento', 'TBR scan: ao bipar no carregamento, fecha automaticamente o insucesso do TBR', '2026-03-14 20:45:00+00'),

-- Março 14 — Multi Features
('create', 'Carregamento', 'Botão CSV: exporta relatório de todos os TBRs bipados com motorista, hora e status', '2026-03-14 21:00:00+00'),
('create', 'Carregamento', 'Lupa de busca por TBR adicionada ao modal maximizado do card de motorista', '2026-03-14 21:05:00+00'),
('update', 'Carregamento', 'Botão de câmera removido dos cards e do modal maximizado (apenas teclado permanece)', '2026-03-14 21:10:00+00'),
('update', 'PS', 'Modo de digitação livre: ao ativar teclado, busca somente ao pressionar Enter', '2026-03-14 21:15:00+00'),
('create', 'PS', 'Botão Sem Embalagem: registra PS sem TBR identificável (embalagem desconhecida)', '2026-03-14 21:20:00+00'),
('create', 'PS', 'Lupa de busca por TBR adicionada ao filtro da tabela de PS', '2026-03-14 21:25:00+00');
