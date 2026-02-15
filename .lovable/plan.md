

# Anexo 1: Login unico por dia + Anexo 2: Pagina de Relatorios do Gerente

---

## Anexo 1 -- Login unico (liberado apos 00:00 Brasilia)

### Regra de negocio
Quando um login (`unit_logins`) e atribuido a um carregamento (`driver_rides.login`), ele fica bloqueado para uso em qualquer outro carregamento ate o dia seguinte (00:00 horario de Brasilia). Isso significa:

- Na pagina de **Conferencia Carregamento**, ao editar/atribuir um login a um ride, o sistema verifica se aquele login ja foi usado em outro ride do mesmo dia.
- Se ja estiver em uso, exibe um aviso e impede a atribuicao.
- A meia-noite (00:00 America/Sao_Paulo), todos os logins ficam disponiveis novamente.

### Alteracoes tecnicas

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

1. No `renderEditableField`, ao salvar o campo `login`, antes de gravar no banco verificar se ja existe outro `driver_rides` do mesmo dia (`completed_at` entre inicio e fim do dia em Brasilia) com o mesmo valor de `login` para o mesmo `unit_id`. Se existir, exibir toast de erro e impedir o salvamento.
2. Mesma validacao no carrossel quando o gerente edita o campo login inline.

---

## Anexo 2 -- Pagina de Relatorios do Gerente

### Descricao
Criar a pagina `/dashboard/relatorios` acessivel pelo menu do gerente. A pagina tera botoes para gerar diferentes relatorios, com destaque para a **Folha de Pagamento dos Motoristas**.

### Botoes de relatorios planejados

1. **Folha de Pagamento Motorista** -- filtro por periodo (data inicio/fim), gera PDF profissional
2. **Resumo Diario de Operacao** -- resumo consolidado do dia selecionado
3. **Relatorio de Retornos** -- todos os retornos piso, PS e RTO do periodo
4. **Relatorio de Performance** -- ranking de motoristas por performance

### Folha de Pagamento -- Detalhes do PDF

O PDF sera gerado no navegador usando uma biblioteca leve (criacao via `window.print()` com area de impressao estilizada ou gerado com canvas/HTML-to-print). Conteudo:

**Pagina 1 -- Tabela Resumo:**
- Tabela com colunas: Nome do Motorista | Dias Trabalhados | Logins Usados | Total TBRs | Retornos | TBRs Concluidos | Valor Total (R$)
- Totalizadores na ultima linha

**Paginas seguintes -- Ficha individual por motorista:**
- Nome, CPF, placa, modelo do carro
- Lista de dias trabalhados com login usado em cada dia
- Metricas: total de TBRs, retornos (piso/PS/RTO), taxa de conclusao, valor ganho
- Mini-grafico de performance por dia (barras simples em CSS)
- Insights: melhor dia, pior dia, media diaria de TBRs

### Alteracoes tecnicas

**Novo arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`
- Pagina com 4 botoes de relatorio em cards
- Filtro de data (inicio/fim) no topo
- Ao clicar em "Folha de Pagamento", busca dados do periodo:
  - `driver_rides` filtrado por `unit_id` e periodo
  - `ride_tbrs` para contar TBRs
  - `piso_entries`, `ps_entries`, `rto_entries` para retornos
  - `drivers` para dados cadastrais
  - `unit_settings` para valor do TBR
- Renderiza uma div oculta com o layout do relatorio formatado para impressao
- Chama `window.print()` para gerar o PDF

**Arquivo:** `src/App.tsx`
- Adicionar rota `/dashboard/relatorios` com o componente `RelatoriosPage`

### Layout da pagina

```text
+--------------------------------------------------+
|  Relatorios                                       |
|  [Data Inicio]  [Data Fim]                        |
|                                                   |
|  +--------------------+  +--------------------+   |
|  | Folha Pagamento    |  | Resumo Diario      |   |
|  | Motorista          |  | Operacao           |   |
|  | [Gerar PDF]        |  | [Gerar PDF]        |   |
|  +--------------------+  +--------------------+   |
|  +--------------------+  +--------------------+   |
|  | Relatorio          |  | Relatorio          |   |
|  | Retornos           |  | Performance        |   |
|  | [Gerar PDF]        |  | [Gerar PDF]        |   |
|  +--------------------+  +--------------------+   |
+--------------------------------------------------+
```

### Conteudo do PDF -- Folha de Pagamento

```text
=== PAGINA 1 ===
FOLHA DE PAGAMENTO - [Unidade] - [Periodo]
+--------+------+--------+------+-----+----------+----------+
| Motora | Dias | Logins | TBRs | Ret | Concluid | Valor R$ |
+--------+------+--------+------+-----+----------+----------+
| Jose   |   5  | isac.. |  45  |  2  |    43    | R$107,50 |
| Maria  |   3  | souza  |  30  |  0  |    30    | R$ 75,00 |
+--------+------+--------+------+-----+----------+----------+
| TOTAL  |   8  |   —    |  75  |  2  |    73    | R$182,50 |
+--------+------+--------+------+-----+----------+----------+

=== PAGINA 2+ (uma por motorista) ===
FICHA INDIVIDUAL - Jose da Silva
CPF: 123.456.789-00 | Placa: ABC1234 | Celta Preto

Dias trabalhados:
  10/02 - Login: isac   - 12 TBRs - 1 retorno - R$27,50
  11/02 - Login: souza  - 10 TBRs - 0 retorno - R$25,00
  ...

Metricas:
  Total TBRs: 45  |  Retornos: 2  |  Conclusao: 95.6%
  Melhor dia: 11/02 (15 TBRs)
  Media diaria: 9 TBRs
  Valor total: R$ 107,50
```
