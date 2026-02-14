

## Correcoes - Card Instantaneo e Status "Em Carregamento"

### Problema 1: Card nao aparece instantaneamente na Conferencia

A tabela `driver_rides` nao tem Realtime habilitado. Quando o gerente programa um carregamento, o card so aparece apos recarregar a pagina manualmente.

**Solucao:** Criar uma migracao SQL para habilitar Realtime na tabela `driver_rides`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_rides;
```

A pagina `ConferenciaCarregamentoPage.tsx` ja escuta mudancas via `postgres_changes` na tabela `driver_rides`, entao basta habilitar a publicacao no banco.

---

### Problema 2: Botao do motorista deve mostrar "Em Carregamento"

Atualmente, quando o gerente programa o motorista, o status da fila muda para "completed" e o motorista volta a ver "Entrar na Fila". O correto e:

- Apos o gerente programar, o motorista deve ver **"Em Carregamento"** com informacoes da rota/login
- O botao so volta para "Entrar na Fila" quando o conferente clicar em **Finalizar** no card de conferencia

**Arquivo:** `src/pages/driver/DriverQueue.tsx`

Logica nova:
1. Ao carregar a pagina, verificar se o motorista tem uma ride ativa hoje (`loading_status` = 'pending' ou 'loading') na tabela `driver_rides`
2. Se tiver, exibir um card "Em Carregamento" com informacoes de rota, login, numero de sequencia e status
3. Escutar Realtime na tabela `driver_rides` para atualizar instantaneamente quando o conferente finalizar
4. Quando `loading_status` mudar para 'finished', voltar a mostrar o botao "Entrar na Fila"

---

### Detalhes Tecnicos

**Migracao SQL:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_rides;
```

**Arquivos modificados:**
- `src/pages/driver/DriverQueue.tsx` -- adicionar verificacao de ride ativa e exibir estado "Em Carregamento"

**Fluxo do motorista:**
1. Motorista entra na fila (botao "Entrar na Fila")
2. Gerente programa (modal Rota/Login/Senha) -- ride criada com `loading_status: 'pending'`
3. Motorista ve instantaneamente: tela muda para "Em Carregamento" com info da rota
4. Conferente clica Iniciar -> status muda para 'loading' (motorista continua vendo "Em Carregamento")
5. Conferente clica Finalizar -> status muda para 'finished' -> motorista volta a ver "Entrar na Fila"
