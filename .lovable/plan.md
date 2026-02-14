

# Campo de Busca TBR - Visao Geral

## Resumo

Adicionar um campo de busca de TBR (codigo de pacotes Amazon) na pagina Visao Geral do dashboard, posicionado abaixo do bloco "Bem-vindo" / data-hora. O campo tera um icone de lupa e ao pressionar Enter abrira um modal informando que a funcionalidade sera implementada em breve (pois a tabela de TBR ainda nao existe no sistema).

## Alteracoes

### Arquivo: `src/pages/dashboard/DashboardHome.tsx`

1. **Campo de busca TBR**
   - Input com placeholder "Buscar TBR..." posicionado logo abaixo da linha do "Bem-vindo"
   - Icone `Search` (lupa) do lucide-react ao lado esquerdo do campo
   - O campo aceita digitacao manual e leitura de QR Code / codigo de barras (leitores externos enviam texto + Enter automaticamente)
   - Ao pressionar Enter, abre um modal (Dialog) com as informacoes do TBR

2. **Modal de resultado**
   - Ao dar Enter no campo, abre um Dialog informando que o rastreamento TBR sera implementado em breve
   - Estrutura do modal ja preparada para exibir: codigo TBR, status, historico passo a passo e demais dados
   - Quando a tabela de TBR for criada futuramente, bastara conectar a busca ao banco de dados

## Layout

```text
+----------------------------------+-----------------------------+
| Bem-vindo                        |  [relogio] sabado, 14 de    |
| ABC-AMZL -- UNIDADE 1            |  fevereiro de 2026  18:05   |
+----------------------------------+-----------------------------+
| [lupa] Buscar TBR...                                           |
+----------------------------------------------------------------+
|                                                                |
|  (espaco para futuros cards)                                   |
+----------------------------------------------------------------+
```

## Detalhes tecnicos

- Importar `Search` do lucide-react
- Importar componentes `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` de `@/components/ui/dialog`
- Estado local: `tbrSearch` (string) e `showTbrModal` (boolean)
- `onKeyDown` no input: ao detectar Enter e campo nao vazio, setar `showTbrModal = true`
- O campo tera largura total (`w-full`) com o icone posicionado dentro usando `relative` + `absolute`
- Nenhuma alteracao de banco de dados necessaria neste momento
