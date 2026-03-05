

## Plano: Zerar todos os TBRs dos carregamentos

### O que será feito
- Executar `DELETE FROM ride_tbrs` para remover todos os 16.247 registros
- Isso zera os TBRs bipados em todos os carregamentos de todos os motoristas/unidades/domínios

### O que NÃO será afetado
- `piso_entries` (insucessos) — mantido
- `ps_entries` — mantido
- `rto_entries` — mantido
- `dnr_entries` — mantido
- `driver_rides` (os carregamentos em si) — mantidos, apenas sem TBRs

### Impacto
- Todos os cards de carregamento mostrarão 0 TBRs lidos
- Os motoristas verão 0 TBRs/ganhos nos períodos afetados
- Operação irreversível

### Execução
Uma única operação de DELETE na tabela `ride_tbrs` via insert tool.

