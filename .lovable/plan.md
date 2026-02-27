

# Plano: Matriz Admin — Etapa 1 (Infraestrutura + Cadastro do Diretor)

## Resumo

Ao criar um domínio, a unidade "MATRIZ ADMIN" será criada automaticamente. Na página de Gerenciadores, ao selecionar um domínio sem escolher unidade, aparece o campo de cadastro do diretor (CPF + senha). Ao selecionar uma unidade, aparece o fluxo atual de gerenciadores. O diretor acessa pelo login normal (seleciona domínio → unidade "MATRIZ ADMIN" → CPF + senha da unidade) e é redirecionado para o painel `/matriz`.

---

## 1. Migração SQL

```sql
-- Coluna is_matriz na tabela units
ALTER TABLE units ADD COLUMN is_matriz boolean NOT NULL DEFAULT false;

-- Tabela de diretores (CPF + senha, vinculado ao domínio via unidade Matriz)
CREATE TABLE directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  name text NOT NULL,
  cpf text NOT NULL,
  password text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE directors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active directors" ON directors FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can read all directors" ON directors FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert directors" ON directors FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update directors" ON directors FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete directors" ON directors FOR DELETE USING (true);

-- View pública para diretores (sem senha)
CREATE VIEW directors_public AS
SELECT id, unit_id, name, cpf, active, created_at FROM directors;
```

## 2. Trigger: Auto-criar "MATRIZ ADMIN" ao inserir domínio

Na mesma migração SQL, criar uma function + trigger:

```sql
CREATE OR REPLACE FUNCTION auto_create_matriz_unit()
RETURNS trigger AS $$
BEGIN
  INSERT INTO units (domain_id, name, password, is_matriz)
  VALUES (NEW.id, 'MATRIZ ADMIN', 'matriz_default', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_matriz
AFTER INSERT ON domains
FOR EACH ROW EXECUTE FUNCTION auto_create_matriz_unit();
```

## 3. Edge Function `authenticate-unit` — Suporte a Diretor

Após o bloco de CPF (linha ~90), antes de checar `user_profiles`, adicionar checagem da tabela `directors`:

```
Se rawDocument.length <= 11 (CPF):
  1. Checar directors WHERE unit_id = unit_id AND cpf = rawDocument AND active = true
  2. Se encontrou → validar password do diretor (não da unidade) → retornar sessionType: "matriz"
  3. Se não → continuar fluxo normal (user_profiles → drivers)
```

## 4. Auth Store

| Alteração |
|---|
| Adicionar `"matriz"` ao tipo `SessionType` |

## 5. Redirects

| Arquivo | Alteração |
|---|---|
| `Index.tsx` | Antes do `if (unitSession)`: `if (unitSession?.sessionType === "matriz") return <Navigate to="/matriz" replace />;` |
| `DashboardLayout.tsx` | Após check de driver: `if (unitSession.sessionType === "matriz") return <Navigate to="/matriz" replace />;` |

## 6. DomainsUnitsPage — Auto "MATRIZ ADMIN"

O trigger SQL cria automaticamente. Na UI, a unidade "MATRIZ ADMIN" já aparecerá listada. Opcionalmente, marcar visualmente com badge "Matriz" e impedir exclusão.

## 7. ManagersPage — Campo de Diretor

Quando `selectedDomain` está preenchido mas `selectedUnit` está vazio:
- Mostrar seção "Diretor do Domínio" com campos: Nome, CPF (formatado), Senha, botão +
- Listar diretores existentes da unidade Matriz daquele domínio (buscar `units` com `is_matriz = true` e `domain_id`, depois `directors_public` com `unit_id`)
- Ações: visualizar, editar, toggle ativo, excluir

Quando `selectedUnit` é preenchido → fluxo atual de gerenciadores (sem mudanças).

## 8. Layout e Rotas Matriz (placeholder)

| Arquivo | Descrição |
|---|---|
| `src/components/matriz/MatrizLayout.tsx` | Layout com sidebar + header "Diretoria — {domínio}" + Outlet |
| `src/components/matriz/MatrizSidebar.tsx` | Menu lateral: Visão Geral, Unidades, Motoristas, Financeiro, Ocorrências, Sair |
| `src/pages/matriz/MatrizOverview.tsx` | Página principal com 12 KPIs + 8 gráficos (conforme plano anterior) |
| `src/App.tsx` | Rota `/matriz` com `MatrizLayout` e subrota index `MatrizOverview` |

## 9. Arquivos a criar

- `src/components/matriz/MatrizLayout.tsx`
- `src/components/matriz/MatrizSidebar.tsx`
- `src/pages/matriz/MatrizOverview.tsx`

## 10. Arquivos a modificar

- `src/stores/auth-store.ts` — SessionType
- `src/pages/Index.tsx` — redirect matriz
- `src/components/dashboard/DashboardLayout.tsx` — redirect matriz
- `src/App.tsx` — rotas /matriz
- `supabase/functions/authenticate-unit/index.ts` — login de diretor
- `src/pages/admin/DomainsUnitsPage.tsx` — badge visual na Matriz Admin
- `src/pages/admin/ManagersPage.tsx` — seção de cadastro de diretor

## 11. Ordem de execução

1. Migração SQL (is_matriz + directors + trigger)
2. Edge function authenticate-unit
3. Auth store + redirects
4. ManagersPage (cadastro diretor)
5. DomainsUnitsPage (badge Matriz)
6. MatrizLayout + MatrizSidebar + MatrizOverview + rotas

