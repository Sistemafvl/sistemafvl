

# Plano: Melhorias no Excel da Folha de Pagamento

## Contexto

O Excel atual gera uma seção única simples. As imagens mostram que o modelo completo tem:

1. **Cabeçalho melhorado** com unidade, gerador, período e cores (amarelo/verde)
2. **Linha de totais diários** na seção principal (já existe parcialmente mas faltam os totais por coluna de dia)
3. **Segunda seção**: "MOTORISTAS - MÍNIMO DE 60 PACOTES" com motoristas que têm `min_packages` configurado
4. **Bloco consolidado**: Tabela resumo com totais diários cruzados entre seções (MOTORISTAS POR PACOTES + MÍNIMO 60 + Total Pacotes + TOTAL PACOTES AMAZON + Diferença)
5. **Resumo final expandido**: 3 linhas (MOTORISTAS POR PACOTES, MÍNIMO DE 60 PACOTES, CUSTO POR PACOTE) com Qtd. Pacotes, Valor Total e Média Pacote

## Mudanças

### 1. Atualizar `generatePayrollExcel.ts`

Receber parâmetros adicionais: `generatedBy`, `minPackageDrivers` (motoristas com mínimo configurado).

**Estrutura do Excel:**

```text
Linha 1: "MOTORISTAS FIXOS POR PACOTES" (fundo amarelo)
Linha 3: "DADOS FINANCEIROS"
Linha 4: Unidade: X | Período: dd/MM/yyyy a dd/MM/yyyy | Gerado por: Y
Linha 5: Headers (fundo amarelo)
Linhas 6+: Dados motoristas principais
Linha N: TOTAL (fundo verde) com totais diários

[espaço]

Linha M: "MOTORISTAS - MÍNIMO DE 60 (SESSENTA) PACOTES" (fundo verde)
Linha M+1: "DADOS FINANCEIROS"
Linha M+2: Headers
Linhas M+3+: Motoristas com min_packages (mesmo formato)
Linha T: Total Motoristas Adicionais (fundo verde)

[espaço]

Bloco consolidado:
- MOTORISTAS POR PACOTES | totais diários | TOTAL
- MOTORISTAS - MÍNIMO DE 60 PACOTES | totais diários | TOTAL
- Total Pacotes | totais diários | TOTAL

[espaço]

RESUMO:
- Header: RESUMO | Qtd. Pacotes Entregues | Valor Total | Média Pacote
- MOTORISTAS POR PACOTES | qtd | valor | média
- MOTORISTAS - MÍNIMO DE 60 PACOTES | qtd | valor | média
- CUSTO POR PACOTE (total) | qtd | valor | média
```

### 2. Atualizar `RelatoriosPage.tsx`

Na chamada do `generatePayrollExcel`, passar:
- `generatedBy` (já disponível)
- Dados de `driver_minimum_packages` (já consultados em `minPkgMap`)
- Separar motoristas: os que têm `min_packages > 0` mas **sem rides no período** vão para a seção de mínimo
- Motoristas com rides vão para a seção principal (como hoje)

### 3. Lógica de separação

- **Seção principal**: Todos os motoristas que tiveram rides no período (já existem em `payrollData`)
- **Seção mínimo**: Consultar `driver_minimum_packages` da unidade, buscar motoristas que têm mínimo configurado. Listar todos com seus nomes, mesmo que sem dados — colunas diárias vazias

### Detalhes técnicos

- `xlsx` (SheetJS community) não suporta cores/estilos nativamente. As cores serão aplicadas apenas se usarmos `xlsx-style` ou formatação limitada. Alternativa: usar merge de células e comentários para simular. Na prática, a versão community do SheetJS não exporta estilos — vou documentar isso mas estruturar os dados para ficarem visualmente organizados mesmo sem cores.
- A logo não pode ser inserida no Excel com SheetJS community edition (limitação da lib). Será incluída como texto "Sistema FVL" no cabeçalho.
- O nome do arquivo mantém o padrão atual.

