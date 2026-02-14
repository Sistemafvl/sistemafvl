

# Funcionalidade "Entrar na Fila" para Motoristas

## Resumo

O motorista ja selecionou a unidade ao fazer login, entao a pagina "Entrar na Fila" ja sabe em qual dominio/unidade ele esta. A pagina exibira um botao para entrar na fila, e ao entrar mostrara: posicao na fila, tempo medio estimado de espera e um relogio contador em tempo real.

## Banco de dados

Criar tabela `queue_entries` para controlar a fila:

```text
queue_entries
  - id (uuid, PK)
  - driver_id (uuid, FK -> drivers.id)
  - unit_id (uuid, FK -> units.id)
  - position (integer) -- calculado dinamicamente
  - status (text: "waiting", "called", "completed", "cancelled")
  - joined_at (timestamptz, default now())
  - called_at (timestamptz, nullable)
  - completed_at (timestamptz, nullable)
```

Politicas RLS: leitura publica (anon pode ler para ver a fila), insercao/atualizacao publica (motoristas nao usam auth do Supabase, usam sessao custom).

Habilitar Realtime na tabela para atualizacoes em tempo real.

## Interface da pagina DriverQueue

### Estado inicial (fora da fila)

```text
+----------------------------------------------------------------+
| [icone] Entrar na Fila                                         |
|----------------------------------------------------------------|
| Dominio: ABC-AMZL                                              |
| Unidade: UNIDADE 1                                             |
|                                                                |
| Motoristas na fila: 5                                          |
| Tempo medio de espera: ~25 min                                 |
|                                                                |
|        [======= ENTRAR NA FILA =======]                        |
+----------------------------------------------------------------+
```

### Estado na fila (apos entrar)

```text
+----------------------------------------------------------------+
| [icone] Entrar na Fila                                         |
|----------------------------------------------------------------|
| Dominio: ABC-AMZL                                              |
| Unidade: UNIDADE 1                                             |
|                                                                |
|  +------------------------------------------+                  |
|  | Voce esta na fila!                        |                  |
|  |                                           |                  |
|  |   Sua posicao:  3o                        |                  |
|  |   Tempo estimado: ~15 min                 |                  |
|  |   Tempo na fila: 00:04:32  (relogio)      |                  |
|  +------------------------------------------+                  |
|                                                                |
|        [======= SAIR DA FILA =======]                          |
+----------------------------------------------------------------+
```

## Logica principal

1. Ao abrir a pagina, buscar todas as entradas com `status = "waiting"` para a `unit_id` do motorista
2. Verificar se o motorista ja esta na fila (buscar por `driver_id` + `status = "waiting"`)
3. **Entrar na fila**: inserir registro em `queue_entries` com `status: "waiting"`
4. **Posicao**: contar quantos registros "waiting" tem `joined_at` anterior ao do motorista + 1
5. **Tempo medio**: calcular media de duracao entre `joined_at` e `completed_at` dos ultimos registros concluidos, multiplicar pela posicao
6. **Relogio contador**: timer local que conta o tempo desde `joined_at` do motorista, atualizado a cada segundo
7. **Sair da fila**: atualizar status para "cancelled"
8. **Realtime**: assinar canal da tabela `queue_entries` filtrado por `unit_id` para atualizar posicao e contagem automaticamente

## Alteracoes por arquivo

### 1. Migracao SQL (nova tabela `queue_entries`)
- Criar tabela com colunas listadas acima
- Foreign keys para `drivers` e `units`
- Politicas RLS permissivas (sistema usa autenticacao custom, nao Supabase Auth)
- Habilitar Realtime

### 2. `src/pages/driver/DriverQueue.tsx` (reescrever)
- Importar `useAuthStore` para obter `unitSession` (domain_name, unit name, unit id)
- Estados: `inQueue`, `queueEntry`, `queueCount`, `position`, `elapsedSeconds`
- `useEffect` para buscar estado atual da fila ao montar
- `useEffect` com `setInterval` para o relogio contador (incrementa a cada segundo)
- `useEffect` para Realtime subscription na tabela `queue_entries`
- Funcao `joinQueue`: insert no banco
- Funcao `leaveQueue`: update status para "cancelled"
- Calculo de tempo medio estimado baseado na posicao e media historica
- UI com cards informativos e botao de acao

## Detalhes tecnicos

- O `driver_id` vem de `unitSession.user_profile_id` (que e o id do motorista na tabela drivers)
- O tempo medio e calculado localmente a partir dos registros `completed` das ultimas 24h
- O relogio usa `setInterval` de 1 segundo, limpo no cleanup do useEffect
- Realtime garante que quando outro motorista entra/sai, a posicao atualiza automaticamente
