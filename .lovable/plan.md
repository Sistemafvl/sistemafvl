

# Plano: Indices de Banco + Edge Function de Limpeza Automática

## Resumo
Criar indices de performance nas tabelas mais pesadas e uma edge function de limpeza automática executada diariamente via cron job.

## 1. Migração: Indices de Performance

Indices a criar (os que já existem serão ignorados):

```text
ride_tbrs:      idx_ride_tbrs_ride_id (ride_id)         -- já tem via unique, mas index puro ajuda
                idx_ride_tbrs_code (upper(code))        -- busca por TBR code

driver_rides:   idx_driver_rides_unit_completed (unit_id, completed_at)  -- filtro mais comum
                idx_driver_rides_loading_status (loading_status)

piso_entries:   idx_piso_entries_unit_status (unit_id, status)
                idx_piso_entries_tbr_code (upper(tbr_code))

ps_entries:     idx_ps_entries_unit_status (unit_id, status)
                idx_ps_entries_tbr_code (upper(tbr_code))

queue_entries:  (já tem idx_queue_entries_unit_status e driver_status)

rto_entries:    idx_rto_entries_unit_status (unit_id, status)
```

## 2. Migração: Habilitar extensoes pg_cron e pg_net

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## 3. Edge Function: `cleanup-old-data`

Nova edge function em `supabase/functions/cleanup-old-data/index.ts`:
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS
- Deleta registros com mais de 90 dias de:
  - `ride_tbrs` (via join com `driver_rides.completed_at`)
  - `queue_entries` com `status = 'completed'` e `completed_at` > 90 dias
  - `piso_entries` com `status = 'closed'` e `closed_at` > 90 dias
  - `ps_entries` com `status = 'closed'` e `closed_at` > 90 dias
  - `rto_entries` com `status = 'closed'` e `closed_at` > 90 dias
- Retorna contagem de registros deletados por tabela
- **NUNCA** toca em: `drivers`, `driver_rides`, `driver_documents`, `payroll_reports`, `dnr_entries`, dados financeiros

## 4. Cron Job (via insert tool)

Agendar execução diária às 3h:
```sql
SELECT cron.schedule(
  'cleanup-old-data-daily',
  '0 3 * * *',
  $$ SELECT net.http_post(
    url:='https://bptdeuhuhfuczmvasqpn.supabase.co/functions/v1/cleanup-old-data',
    headers:='{"Authorization": "Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) $$
);
```

## 5. Config: verify_jwt = false

Adicionar ao `supabase/config.toml`:
```toml
[functions.cleanup-old-data]
verify_jwt = false
```

## Detalhes Técnicos

- A limpeza de `ride_tbrs` usa subquery: `DELETE FROM ride_tbrs WHERE ride_id IN (SELECT id FROM driver_rides WHERE completed_at < now() - interval '90 days')`
- Isso preserva `driver_rides` (histórico) mas limpa os TBRs individuais que são o maior volume
- Os indices compostos `(unit_id, status)` e `(unit_id, completed_at)` cobrem 90%+ das queries do sistema
- O cron roda 1x/dia, consumo de créditos insignificante (~$0.01/mês)

