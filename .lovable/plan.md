
# Ciclo de Vida do TBR e Cores de Reincidencia

## Resumo

Implementar rastreamento completo do ciclo de vida do TBR, com indicacao visual (roxo para 2a ida, laranja para 3a ida), som de beep, legenda e validacao de que o TBR passou pelo Retorno Piso antes de sair novamente.

## Alteracoes no Banco de Dados

Adicionar coluna `trip_number` na tabela `ride_tbrs` para armazenar em qual viagem o TBR esta (1 = primeira, 2 = segunda, 3 = terceira ou mais).

```text
ALTER TABLE ride_tbrs ADD COLUMN trip_number integer NOT NULL DEFAULT 1;
```

## Alteracoes na Conferencia de Carregamento

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

### 1. Logica de escaneamento do TBR (handleTbrInputChange)

Quando um TBR e escaneado pela primeira vez no carregamento (count === 0), antes de inserir, o sistema fara:

1. **Buscar se o TBR ja existe em outros carregamentos** (`ride_tbrs` com o mesmo `code` em outros `ride_id`)
2. **Se existir em carregamento anterior:**
   - Verificar se existe um `piso_entries` fechado (status = "closed") para esse TBR
   - Se **NAO** existir entrada no Retorno Piso: exibir alerta bloqueando a insercao ("Este TBR precisa ser registrado no Retorno Piso antes de sair novamente")
   - Se existir: calcular `trip_number` (contar quantas vezes o TBR aparece em `ride_tbrs` + 1), inserir com `trip_number`, fechar automaticamente o `piso_entries` aberto (se houver), e tocar beep
3. **Se nao existir em nenhum carregamento anterior:** inserir normalmente com `trip_number = 1`

### 2. Cores na lista de TBRs lidos

Atualizar a interface `Tbr` para incluir `trip_number`:

```text
interface Tbr {
  id: string;
  code: string;
  scanned_at: string;
  trip_number?: number;  // NOVO
  _duplicate?: boolean;
  _triplicate?: boolean;
  _yellowHighlight?: boolean;
}
```

Atualizar `getTbrItemClass` para considerar `trip_number`:
- `trip_number === 2`: fundo roxo claro (`bg-purple-100 text-purple-700`)
- `trip_number >= 3`: fundo laranja claro (`bg-orange-100 text-orange-700`)

### 3. Legenda visual

Adicionar ao lado dos botoes de navegacao (setas) uma legenda com quadrados coloridos:

```text
[<] [>]   [ ] Branco = 1a viagem   [roxo] 2a viagem   [laranja] 3a+ viagem
```

Serao pequenos quadrados (12x12px) com as cores correspondentes e texto descritivo ao lado.

### 4. Beep sonoro

Reutilizar a funcao `playErrorBeep` existente (ou criar variante com tom diferente) para tocar quando um TBR de reincidencia for escaneado.

## Alteracoes no Retorno Piso

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx`

Quando um TBR e adicionado a um novo carregamento (detectado via realtime ou na proxima carga de dados), o sistema fechara automaticamente a entrada aberta no piso. Isso sera feito na logica de escaneamento da Conferencia, nao no RetornoPisoPage em si.

## Secao Tecnica

**Fluxo de validacao no escaneamento (dentro do debounce de 300ms):**

```text
1. code = valor escaneado
2. Buscar ride_tbrs WHERE code = code AND ride_id != rideId atual
3. Se encontrou registros anteriores:
   a. Buscar piso_entries WHERE tbr_code = code AND status = 'closed'
   b. Se NAO encontrou piso_entry fechado:
      -> Bloquear insercao, exibir toast de erro
      -> "TBR precisa ser registrado no Retorno Piso"
   c. Se encontrou:
      -> trip_number = (total de ride_tbrs com esse code) + 1
      -> Inserir ride_tbrs com trip_number
      -> Fechar piso_entries abertos (UPDATE status='closed')
      -> Tocar beep
4. Se NAO encontrou registros anteriores:
   -> Inserir normalmente com trip_number = 1
```

**Mapeamento de cores na fetchRides:**
- Ao buscar os TBRs, incluir `trip_number` no SELECT e mapear para o estado local

**Arquivos modificados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (logica + UI)
- Migracao SQL (nova coluna `trip_number`)
