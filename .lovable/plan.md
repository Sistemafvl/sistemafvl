

## Plano: Sessão Exclusiva de Conferente (Single-Session Lock)

### Problema
Atualmente, dois dispositivos podem selecionar o mesmo conferente simultaneamente, causando conflitos operacionais.

### Solução
Usar uma tabela de sessões ativas com Realtime para detectar quando outro dispositivo assume o mesmo conferente, desconectando automaticamente o primeiro.

### 1. Banco de Dados

**Nova tabela `conferente_sessions`:**
- `id` (uuid PK)
- `unit_id` (uuid NOT NULL)
- `conferente_id` (uuid NOT NULL, UNIQUE) — apenas uma sessão por conferente
- `session_token` (text NOT NULL) — token único por aba/dispositivo
- `started_at` (timestamptz DEFAULT now())

RLS aberta (mesmo padrão do projeto). Habilitar Realtime na tabela.

```sql
CREATE TABLE public.conferente_sessions (...);
ALTER PUBLICATION supabase_realtime ADD TABLE public.conferente_sessions;
```

### 2. Lógica no `DashboardLayout.tsx`

- Ao selecionar conferente: gerar um `sessionToken` único (`crypto.randomUUID()`) e salvar em `sessionStorage` (por aba)
- Upsert na tabela `conferente_sessions` com `onConflict: 'conferente_id'` → substitui a sessão anterior
- Subscribir via Realtime no canal `conferente_sessions` filtrado por `unit_id`
- Quando receber um UPDATE/INSERT para o mesmo `conferente_id` com `session_token` diferente do meu → `setConferenteSession(null)` (kick para tela de seleção)
- Ao deslogar/trocar conferente: deletar o registro da tabela

### 3. Lógica no `DashboardSidebar.tsx`

- Ao selecionar conferente no Select ou ao clicar "Trocar": mesma lógica de upsert
- Ao clicar "Trocar" ou "Sair": deletar sessão da tabela

### 4. Fluxo

```text
Tab A seleciona "Joao Silva" → upsert(conferente_id=X, token=AAA)
Tab B seleciona "Joao Silva" → upsert(conferente_id=X, token=BBB)
  → Realtime notifica Tab A: token mudou de AAA → BBB
  → Tab A: setConferenteSession(null) → volta para tela "Selecione um Conferente"
```

### 5. Cleanup
- Ao fechar aba (`beforeunload`): deletar sessão (best-effort)
- Sessões órfãs não causam problema pois o upsert sempre substitui

### Ordem de Implementação
1. Migração SQL (tabela + realtime)
2. Criar hook `useConferenteSessionLock` com lógica de upsert, realtime e cleanup
3. Integrar no `DashboardLayout.tsx` e `DashboardSidebar.tsx`

