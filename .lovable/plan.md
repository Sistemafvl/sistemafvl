

## Problema

As mudanças recentes (cards indicadores em Insucessos/Motoristas/PS/DNR, campo "Qtd Pacotes Informado" nos Ciclos, spinners de loading, etc.) não foram registradas na tabela `system_updates`. O feed está desatualizado.

## Solução

Não existe um hook de CI/CD disponível na arquitetura atual para detectar deploys automaticamente. A solução prática é:

1. **Inserir agora** todos os registros das mudanças recentes que ficaram faltando (desde 01/03)
2. **Criar uma regra de processo**: a cada implementação futura, o último passo será **sempre** inserir o registro correspondente em `system_updates` via SQL, garantindo que o feed fique atualizado automaticamente

### Registros a inserir agora

| Tipo | Módulo | Descrição |
|------|--------|-----------|
| create | Insucessos | Cards indicadores (Total abertos, Motorista Ofensor, Top Motivo, Top Conferente) e filtros por data, conferente e motorista |
| create | Motoristas Parceiros | Cards indicadores (Total cadastrados, Ativos, Inativos, Estados) |
| create | PS (Problem Solve) | Cards indicadores (Total PS, Abertos vs Finalizados, Top Motivo, % Seller) |
| create | DNR | Cards indicadores (Total DNRs, Valor total, Status, Valor com desconto) |
| update | Ciclos | Novo campo "Qtd Pacotes Informado" com diferença exibida no relatório |
| update | Conferência de Carregamento | Spinner de loading centralizado substituindo skeletons |
| update | Visão Geral | Spinner de loading no card de Avaliação da Unidade |
| update | Insucessos | Correção do auto-close de PS com comparação case-insensitive |

### Arquivo afetado

Nenhum arquivo de código — apenas **INSERT SQL** direto na tabela `system_updates`.

