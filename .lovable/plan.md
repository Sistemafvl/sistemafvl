

## Plano: Criar tabela `driver_contracts` e painel de aceites para diretores

### Problema
A tabela `driver_contracts` não existe no banco de dados, causando o erro ao motorista tentar aceitar o contrato. Além disso, o diretor não tem visibilidade sobre quais motoristas aceitaram ou não.

### 1. Migração SQL — criar tabela `driver_contracts`

```sql
CREATE TABLE public.driver_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, contract_id)
);

ALTER TABLE public.driver_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read driver_contracts" ON public.driver_contracts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert driver_contracts" ON public.driver_contracts FOR INSERT WITH CHECK (true);
```

### 2. ContractEditorPage.tsx — adicionar painel de aceites

Abaixo do editor de contrato, adicionar uma seção "Aceites dos Motoristas" que:
- Busca todos os motoristas vinculados às unidades do domínio do diretor (via `unit_predefined_drivers` ou `driver_rides`)
- Cruza com `driver_contracts` para o contrato atual
- Exibe lista com nome do motorista, status (aceito/pendente) e data do aceite
- Contadores: X aceitos / Y pendentes

### 3. Arquivos alterados
- **Nova migração SQL** — criar tabela `driver_contracts`
- `src/pages/matriz/ContractEditorPage.tsx` — adicionar seção de aceites dos motoristas

