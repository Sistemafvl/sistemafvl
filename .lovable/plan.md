
Objetivo imediato
- Corrigir o erro financeiro da Folha (Gerar/Consultar/Espelho) para bater 100% com Operação e visão do motorista.
- Corrigir relatórios já salvos (documentos financeiros) sem precisar apagar e refazer manualmente.
- Ajustar o bipe 3x para comportamento instantâneo: manter 1º TBR amarelo e remover apenas duplicatas temporárias (sem sumir da lista).

Diagnóstico confirmado
1) Folha com 72 vs 73
- A causa está no cálculo de retornos da Folha: ele ainda considera registros operacionais de piso (“Removido do carregamento”, etc.) em parte da lógica.
- Em dados reais, existe caso em que um registro operacional entrou no desconto de retorno e derrubou 1 unidade no dia.
- Também há comparação sensível a maiúsculas/minúsculas em pontos críticos da Folha, diferente de Operação.

2) Bipe 3x sumindo/reaparecendo
- No fluxo atual, no 3º bipe o código escolhe o item errado como “primeiro” em alguns cenários (quando há item temporário do 2º bipe), e acaba deletando o registro real.
- Resultado: TBR some da lista e volta depois (efeito de atraso/realtime).

Plano de implementação

1. Corrigir definitivamente o cálculo da Folha para espelhar Operação
Arquivo: src/pages/dashboard/RelatoriosPage.tsx
- Reescrever a parte de retornos do fetchPayrollData com a mesma regra usada em Operação:
  - Filtrar piso operacional usando OPERATIONAL_PISO_REASONS.
  - Normalizar códigos com toUpperCase().
  - Contar retorno por ride apenas quando o TBR ainda existe em ride_tbrs daquela ride (retorno líquido).
- Substituir a lógica atual de “netReturns por dia” por agregação por ride (igual Operação), depois somar por dia.
- Manter Gerar/Consultar/Espelho apontando para a mesma função (já estão), então os 3 ficarão consistentes de uma vez.

2. Corrigir retroativamente relatórios já salvos (urgente financeiro)
Arquivos: 
- src/pages/dashboard/FinanceiroPage.tsx
- (novo helper) src/lib/payroll-recalc.ts
- Criar rotina de “recalcular relatório salvo” por report_id:
  - Recalcula TBRs/retornos/concluídos com a nova regra correta.
  - Atualiza payroll_reports.report_data.
- Criar ação em Financeiro para correção em lote da unidade (com confirmação por senha de gerente), para não depender de ajuste manual relatório a relatório.
- Preservar vínculo documental existente (IDs dos relatórios e invoices), alterando somente os números corrigidos no report_data.
- Registrar no feed de system_updates que houve correção retroativa financeira.

3. Corrigir bipe 3x para ficar instantâneo e estável
Arquivo: src/pages/dashboard/ConferenciaCarregamentoPage.tsx
- Ajustar branch count >= 2 para:
  - Nunca deletar o registro base correto.
  - Marcar o registro base como highlight = "yellow" imediatamente.
  - Remover apenas entradas temporárias/duplicadas da UI de forma imediata (sem esperar timeout para “voltar”).
- Manter persistência do amarelo no banco (para sobreviver refetch/realtime), mas sem fluxo que cause sumiço transitório.
- Revisar seleção de “primeiro registro” para não depender da posição atual quando há item temporário.

Detalhes técnicos (resumo)
- Sem mudança de schema de banco.
- Mudanças só de lógica de cálculo e atualização de dados já existentes.
- Regra fonte de verdade para folha passará a ser a mesma da Operação:
  - retorno válido = código em piso/ps/rto (piso não-operacional) e presente na ride_tbrs da ride correspondente, com comparação case-insensitive.

Validação que vou executar após implementar
1) Caso crítico do usuário (Willian 03/03): Folha deve mostrar 73 (não 72) e bater com Operação.
2) Gerar, Consultar e Espelho no mesmo período devem mostrar exatamente os mesmos números.
3) Rodar correção retroativa e conferir que relatórios antigos da unidade foram atualizados.
4) Teste de bipe 3x: o TBR não pode sumir; deve ficar amarelo imediatamente e permanecer amarelo após refetch/reload.
5) Conferir um TBR com histórico de reprocessos para garantir que timeline e contadores continuam consistentes.
