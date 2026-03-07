

## Plano

### 1. Ícone do PWA em dispositivos já instalados

Infelizmente, **não é possível** atualizar o ícone da tela inicial remotamente. O ícone é salvo pelo sistema operacional no momento da instalação:

- **Android (Chrome):** Pode atualizar automaticamente após ~30 dias se detectar mudança no manifest, mas não é garantido.
- **iOS (Safari):** Nunca atualiza — o usuário precisa remover e adicionar novamente.

A única solução confiável é pedir para desinstalar e reinstalar. O service worker (autoUpdate) atualiza código, cache e assets internos, mas o ícone da home screen é controlado pelo OS.

### 2. Limpar tabela e manter apenas as 40 mais recentes

A tabela tem 69 registros. Vou deletar os 29 mais antigos, mantendo apenas os 40 mais recentes cronologicamente.

```sql
DELETE FROM system_updates
WHERE id NOT IN (
  SELECT id FROM system_updates ORDER BY published_at DESC LIMIT 40
);
```

### 3. Automatizar inserção de atualizações

Isso já é uma regra de processo (registrada em memória). A cada implementação/correção que fazemos, o INSERT na `system_updates` é feito como etapa final. Vou reforçar isso garantindo que nunca mais esqueça.

### Arquivos afetados
- Nenhum arquivo de código alterado
- Apenas operação DELETE na tabela `system_updates`

