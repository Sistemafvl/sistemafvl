

## Plano: Inserir TBRs em massa - 28/02 SSP9 (43 rides)

### Resumo
Criar uma edge function temporária `bulk-insert-tbrs` que recebe a lista de `{ride_id, count}` e insere TBRs aleatórios únicos (formato `TBR` + 10 dígitos) na tabela `ride_tbrs`.

### Renan Ribeiro - resolvido
O segundo card dele (13 TBRs) é o ride `4cba5f87-ee17-485b-bd37-0c5be2f82353` (completed_at 2026-02-28 22:47 horário BR). Está mapeado.

### Execução

**1. Criar edge function `supabase/functions/bulk-insert-tbrs/index.ts`**
- Recebe JSON com array de `{ride_id, count}`
- Gera códigos únicos `TBR` + 10 dígitos aleatórios
- Insere em `ride_tbrs` com `trip_number = 1`, `scanned_at = now()`
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS

**2. Adicionar config em `supabase/config.toml`**
```toml
[functions.bulk-insert-tbrs]
verify_jwt = false
```

**3. Chamar a function com os 43 mapeamentos:**

| Motorista | TBRs | ride_id |
|---|---|---|
| Márcio Ferreira | 78 | e1d78e23... |
| Thiago Galvão | 92 | 6651c626... |
| Jackson Carvalho | 90 | 5296fa05... |
| Ribamar Santos | 81 | 631fa823... |
| Shirlei Cavalcanti | 108 | 48a9f6e9... |
| Clodoaldo Silva | 71 | b7765157... |
| Willian Santos | 59 | aad814bf... |
| Mateus Borges | 82 | 75ba2853... |
| Raimundo Da Silva | 84 | 6e7579db... |
| Walace Sampaio | 75 | ea00fb3d... |
| Marcelo Pereira Da Luz | 93 | d6216a10... |
| Renan Ribeiro (1a saída) | 36 | d854fafc... |
| Natan Ribeiro | 68 | ee270124... |
| Leandro Landes | 39 | 7ccd1bd9... |
| Marcos Nunes | 90 | a86bf480... |
| Márcio Cruz | 74 | a8131fe9... |
| Robson Pereira | 69 | 45faf998... |
| Davi Souza | 87 | c6a9d7d5... |
| Lenildes Alves | 48 | ad519c1f... |
| Mikael Soares | 33 | 74bcf634... |
| Marcelo De Oliveira | 70 | 876adf65... |
| Wesley Mussi | 42 | b3e976e9... |
| Advaldo Rodrigues | 62 | 487f7590... |
| William Cavalcante | 50 | 042e80a9... |
| Ygor Vinícius | 13 | 7eb89714... |
| Eduardo Cerqueira | 51 | ee0d1daa... |
| Diogo Vieira | 46 | 7d3753e2... |
| Sarah Soares | 55 | 2e13b531... |
| Agnaldo Pereira | 27 | 744bb943... |
| Wendell Lucas | 70 | 99245701... |
| Maria Eduarda | 76 | ec07e32c... |
| Kaique Soares | 35 | 4776eb23... |
| Juliane Pereira | 60 | 812cdf22... |
| Sandro Andrade | 30 | 25ff1a67... |
| Lucas Pereira | 33 | bcaba705... |
| Micheal Adewale | 77 | 488957f3... |
| Bruno Vieira | 21 | f7355c45... |
| Roberto Reinaldo | 19 | 40009cf5... |
| Márcio Roberto | 12 | cbf5f05f... |
| Vitor Carvalho | 35 | 8e430849... |
| Adelangela Delata | 50 | ed517e15... |
| Emerson Vilela | 43 | e73cd92f... |
| Renan Ribeiro (2a saída) | 13 | 4cba5f87... |

**Total: 2.488 TBRs**

**4. Após confirmar inserção, remover a edge function.**

### Arquivos
- Criar: `supabase/functions/bulk-insert-tbrs/index.ts`
- Editar: `supabase/config.toml`

