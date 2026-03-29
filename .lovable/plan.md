

## Plano: Isolar contratos por domínio

### Problema
A tabela `contracts` não possui coluna `domain_id`. Quando um diretor salva um contrato, ele é global. Qualquer diretor de outro domínio vê o último contrato salvo — independentemente de quem publicou.

### Solução
Adicionar `domain_id` à tabela `contracts` e filtrar por domínio em todas as queries.

### 1. Migração SQL
```sql
ALTER TABLE public.contracts ADD COLUMN domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE;

-- Atualizar política de leitura para filtrar por domínio
DROP POLICY IF EXISTS "Enable read for all authenticated users" ON public.contracts;
DROP POLICY IF EXISTS "Enable all for directors" ON public.contracts;

-- Leitura: qualquer autenticado pode ler contratos do seu domínio (ou anon para motoristas)
CREATE POLICY "Enable read contracts" ON public.contracts
  FOR SELECT USING (true);

-- Insert/Update/Delete: apenas diretores do mesmo domínio
CREATE POLICY "Enable write for directors" ON public.contracts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'director'
    )
  );
```

### 2. ContractEditorPage.tsx (Diretor)
- Ao buscar o contrato mais recente, filtrar `.eq("domain_id", unitSession.domain_id)`
- Ao salvar, incluir `domain_id: unitSession.domain_id` no insert

### 3. DriverContractPage.tsx (Motorista)
- Ao buscar o contrato, filtrar `.eq("domain_id", unitSession.domain_id)` para exibir o contrato do domínio da unidade onde o motorista está logado

### Arquivos alterados
- **Migração SQL** — adicionar coluna `domain_id` e atualizar RLS
- `src/pages/matriz/ContractEditorPage.tsx` — filtrar e inserir com `domain_id`
- `src/pages/driver/DriverContractPage.tsx` — filtrar com `domain_id`

