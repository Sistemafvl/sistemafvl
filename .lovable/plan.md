

## Adicionar campo "Senha" ao modal e exibir cards na pagina "Conferencia Carregamento"

### Resumo
Duas mudancas principais:
1. Adicionar campo **Senha** ao modal "Programar Carregamento" (junto com Rota e Login)
2. Criar a pagina **Conferencia Carregamento** (`/dashboard/conferencia`) que exibe os cards de carregamentos programados do dia, em vez de mostrar o card de confirmacao como popup

---

### 1. Migracao de Banco de Dados

Adicionar coluna `password` (TEXT, nullable) na tabela `driver_rides` para armazenar a senha informada pelo gerente.

```sql
ALTER TABLE public.driver_rides
  ADD COLUMN IF NOT EXISTS password TEXT;
```

---

### 2. Alteracoes no QueuePanel

- Adicionar campo **Senha** (input de texto livre) ao modal "Programar Carregamento", entre Login e o botao Definir
- Salvar o valor de `password` no insert de `driver_rides`
- Remover o dialog de confirmacao (card popup) -- a confirmacao sera vista na pagina de Conferencia Carregamento
- Apos clicar "Definir", redirecionar automaticamente para `/dashboard/conferencia` ou exibir um toast de sucesso

---

### 3. Criar pagina Conferencia Carregamento

Nova pagina `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`:

- Busca todos os registros de `driver_rides` do dia atual para a unidade logada
- Para cada registro, exibe um **card** com:
  - Foto do motorista (avatar)
  - Nome do motorista
  - Carro (modelo + cor)
  - Placa
  - Rota
  - Login
  - Senha
  - Sequencia de carregamento (badge "#Xo Carregamento")
- Cards organizados em grid responsivo
- Realtime habilitado para atualizar quando novos carregamentos forem programados

---

### 4. Registrar rota no App.tsx

Adicionar a rota `/dashboard/conferencia` apontando para o novo componente `ConferenciaCarregamentoPage`.

---

### Detalhes Tecnicos

**Arquivos modificados:**
- `src/components/dashboard/QueuePanel.tsx` -- adicionar campo Senha, remover dialog de confirmacao, salvar password no insert
- Nova migracao SQL para coluna `password`

**Arquivos criados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` -- pagina com cards de carregamentos do dia

**Arquivos atualizados:**
- `src/App.tsx` -- adicionar rota `/dashboard/conferencia`

