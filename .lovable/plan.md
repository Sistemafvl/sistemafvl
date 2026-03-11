

# Plano: Ajustes na Folha Excel + BI Tab + Obrigar Dados Bancários

## 5 mudanças solicitadas

### 1. Seção "Mínimo de 60 Pacotes" — repetir motoristas da tabela principal
**Arquivo:** `generatePayrollExcel.ts`

Atualmente a seção de mínimo cria 10 linhas em branco com `R$ 0,00`. A mudança:
- Preencher TODOS os motoristas da tabela principal (mesmos nomes, veículo, valor por pacote, CPF, Chave PIX) — dados copiados da seção 1
- Colunas de datas ficam VAZIAS para preenchimento manual
- TOTAL DE PACOTES, DESCONTOS, ADICIONAL e TOTAL GERAL mantêm fórmulas Excel
- Manter as 10 linhas em branco adicionais abaixo dos motoristas preenchidos (para o gerente adicionar mais)

### 2. Consolidado — adicionar "Total Pacotes Amazon" e "Diferença"
**Arquivo:** `generatePayrollExcel.ts`

Abaixo da linha "Total Pacotes", adicionar:
- **Total Pacotes Amazon**: linha em branco nas colunas de datas (preenchimento manual)
- **Diferença**: fórmula `= Total Pacotes - Total Pacotes Amazon` por coluna de data

### 3. Abas individuais — linha "Média Pacote"
**Arquivo:** `generatePayrollExcel.ts`

No "RESUMO FINANCEIRO" de cada aba de motorista, após "TOTAL A PAGAR", adicionar:
- **Média Pacote**: fórmula `= TOTAL A PAGAR / Total Pacotes Concluídos` (quanto a unidade paga por pacote para esse motorista, considerando bônus, reativo e descontos)

### 4. Nova aba "Indicadores" após "Folha de Pagamento"
**Arquivo:** `generatePayrollExcel.ts`

Criar uma aba com dados tabulados (não gráficos nativos do Excel, pois xlsx-js-style não suporta charts):
- **Ranking por Média Pacote** (valor pago por pacote = Total Geral / Pacotes): do mais barato ao mais caro
- **Ranking por Volume** (quem entrega mais e menos pacotes)
- **Ranking por Custo Total** (quem custa mais e menos)
- **Resumo geral**: total motoristas, média geral por pacote, motorista mais barato, mais caro, maior volume, menor volume
- Colunas: Posição, Nome, Veículo, Pacotes, Valor Total, Média/Pacote
- Estilo com cores e formatação consistentes

### 5. Forçar preenchimento de dados bancários
**Arquivos:** `DriverDailyNotices.tsx`, `DriverLayout.tsx`

Após os 4 modais diários, verificar se o motorista tem `pix_key` preenchida:
- Consultar via edge function `get-driver-details` com `self_access: true`
- Se `pix_key` estiver vazia/null, exibir modal bloqueante informando que precisa preencher dados bancários
- Ao clicar "Ir para Documentos", redirecionar para `/motorista/documentos`
- O modal usa `localStorage` com chave `driver_bank_filled_{id}` para cachear por sessão (se salvou, não mostra mais até recarregar)
- Controle no `DriverDailyNotices`: após o último aviso (índice 3), em vez de fechar, verificar dados bancários

---

## Impacto operacional
- **Zero risco**: todas as mudanças são na geração do Excel (offline) e num modal informativo
- **Nenhuma query adicional em loop**: a verificação bancária ocorre 1 única vez após os avisos diários
- **Sem alteração de layout existente**: apenas adição de linhas/abas no Excel e um modal extra no fluxo do motorista

