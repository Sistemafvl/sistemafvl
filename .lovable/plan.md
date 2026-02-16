

# Relatorios Profissionais com Design Visual + 3 Novos Relatorios

## 1. Folha de Pagamento -- Design Profissional

Redesign completo do PDF gerado, com visual de documento financeiro profissional:

### Cabecalho de cada pagina
- Logo do sistema (src/assets/logo.png) convertido para base64 e embutido no HTML off-screen
- Nome da unidade em destaque
- Periodo do relatorio
- Data/hora de geracao
- Nome do gerente que gerou (obtido de `unitSession.user_name`)

### Ficha individual do motorista (1 pagina por motorista)
- Barra superior colorida (teal/cinza escuro, identidade visual do sistema)
- Dados do motorista: nome, CPF, placa, modelo
- Cards de metricas com fundo colorido (TBRs, Retornos, Concluidos, Taxa, Media, Valor)
- Tabela Login x Dias com cores alternadas e destaque nos valores
- Area de assinatura no rodape: duas linhas com "Assinatura do Gerente" e "Assinatura do Motorista"
- Rodape com "Documento gerado pelo Sistema FVL"

### Pagina de resumo geral (ultima pagina)
- Mesmo cabecalho com logo
- Tabela consolidada: Motorista x Dias x Totais x Valor
- Totalizadores com destaque visual
- Cores: header teal (#0d9488), linhas alternadas, texto escuro

## 2. Relatorio Resumo Diario (NOVO)

Gera PDF com resumo operacional do periodo selecionado:
- Total de carregamentos realizados por dia
- Total de TBRs escaneados
- Total de retornos (Piso + PS + RTO) separados por tipo
- Numero de motoristas ativos por dia
- Tabela: Data | Carregamentos | TBRs | Piso | PS | RTO | Total Retornos
- Dados de `driver_rides`, `ride_tbrs`, `piso_entries`, `ps_entries`, `rto_entries`

## 3. Relatorio de Retornos (NOVO)

Gera PDF listando todos os retornos do periodo:
- Secao Piso: tabela com TBR Code, Motivo, Motorista, Rota, Data
- Secao PS: tabela com TBR Code, Descricao, Motorista, Rota, Data
- Secao RTO: tabela com TBR Code, Descricao, CEP, Motorista, Rota, Data
- Totalizadores por tipo
- Dados de `piso_entries`, `ps_entries`, `rto_entries` com joins nos nomes

## 4. Ranking de Performance (NOVO)

Gera PDF com ranking dos motoristas:
- Tabela ordenada por total de TBRs (desc)
- Colunas: Posicao | Motorista | TBRs | Retornos | Taxa Conclusao | Dias Trabalhados | Media/Dia | Valor
- Destaque visual para top 3 (ouro, prata, bronze)
- Dados ja disponiveis via `driver_rides` + `ride_tbrs` + retornos

## Alteracoes tecnicas

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`
- Completa reescrita do HTML off-screen para design profissional com cores e logo
- Logo carregado como base64 via canvas para embutir no HTML off-screen (html2canvas nao carrega imports do bundler)
- Adicionar `unitSession.user_name` como "Gerado por"
- Adicionar campos de assinatura em cada ficha de motorista
- Criar 3 novas funcoes de fetch + geracao de PDF (resumo diario, retornos, ranking)
- Cada relatorio tera seu proprio ref e HTML off-screen
- Paleta de cores: teal (#0d9488) para headers, cinza claro para alternancia, branco de fundo

