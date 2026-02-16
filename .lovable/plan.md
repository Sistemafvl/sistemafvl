

# Analise de Seguranca + Novas Paginas Master Admin

## Parte 1: Vulnerabilidades Encontradas

### CRITICO: `get-signed-url` sem autenticacao
A Edge Function `get-signed-url` nao valida nenhum token JWT. Qualquer pessoa que conheca o endpoint pode solicitar URLs assinadas para QUALQUER arquivo no bucket `driver-documents`, incluindo CNH, CRLV e comprovantes de residencia. Basta enviar `{ path: "...", bucket: "driver-documents" }`.

**Correcao:** Adicionar validacao minima -- exigir que o `driver_id` no path corresponda ao motorista logado, OU que o solicitante seja um admin/gerente autenticado.

### CRITICO: `get-driver-details` expoe dados bancarios sem autenticacao
Quando `include_password` e `false` (ou omitido), a funcao retorna dados bancarios (banco, agencia, conta, PIX) sem nenhuma verificacao de JWT. Qualquer pessoa pode chamar a funcao com um `driver_id` e obter todos os dados financeiros.

**Correcao:** Exigir autenticacao para QUALQUER chamada. Verificar se o solicitante e o proprio motorista OU um gerente/admin autenticado.

### MODERADO: QueuePanel expoe senhas de `unit_logins`
Na linha 146, `QueuePanel.tsx` consulta `unit_logins` com `select("id, login, password")` e armazena senhas no state. Essas senhas sao usadas para preencher automaticamente o campo "Senha" ao programar um carregamento. Embora funcional, o dado sensivel trafega no frontend.

**Correcao:** Manter por enquanto (necessario para o fluxo de programacao), mas documentar como risco aceito. Alternativa futura: criar Edge Function que insere o ride ja com login/senha sem expor ao frontend.

### MODERADO: Senhas armazenadas em texto plano
Todas as senhas (drivers, managers, units, unit_logins) estao em texto plano no banco. Nao ha hashing.

**Correcao:** Documentar como vulnerabilidade conhecida na pagina de Seguranca. Implementacao de hashing requer refatorar todo o fluxo de autenticacao e esta fora do escopo imediato.

### BAIXO: `admin-validate` CORS headers incompletos
A funcao `admin-validate` usa headers CORS reduzidos comparado as outras funcoes (faltam `x-supabase-client-platform` etc). Pode causar problemas em alguns navegadores.

**Correcao:** Padronizar headers CORS em todas as Edge Functions.

---

## Parte 2: Nova Pagina - Visao Geral (Admin Overview)

### Descricao
Dashboard completo com metricas consolidadas de TODAS as unidades do sistema, com filtros de data, dominio e unidade.

### Funcionalidades
- **Filtros globais:** Periodo (data inicio/fim), Dominio (dropdown), Unidade (dropdown dependente do dominio)
- **Cards de resumo:**
  - Total de carregamentos no periodo
  - Total de TBRs escaneados
  - Total de motoristas ativos
  - Total de PS abertos / fechados
  - Total de RTO abertos / fechados
  - Total de Retornos Piso abertos / fechados
  - Media de avaliacoes (feedbacks)
  - Total de conferentes ativos
- **Graficos (Recharts):**
  - Grafico de barras: Carregamentos por unidade
  - Grafico de linha: Evolucao diaria de carregamentos
  - Grafico de pizza: Distribuicao de status de carregamento
  - Grafico de barras: Top 10 motoristas por volume
- **Insights:**
  - Unidade com mais carregamentos
  - Motorista mais ativo
  - Taxa de PS/RTO por total de TBRs

### Arquivos
- `src/pages/admin/AdminOverviewPage.tsx` (nova pagina)

---

## Parte 3: Nova Pagina - Seguranca Geral

### Descricao
Painel profissional de auditoria de seguranca para o Master Admin avaliar o estado de protecao do sistema.

### Secoes

1. **Resumo de Seguranca** - Score geral com badge (Forte/Moderado/Fraco) baseado nas verificacoes abaixo

2. **Autenticacao e Acesso**
   - Validacao server-side do Master Admin (status: Ativo)
   - Roles armazenados em tabela separada (status: Ativo)
   - Funcao `has_role` com SECURITY DEFINER (status: Ativo)
   - Senhas em texto plano (status: Alerta)

3. **Row Level Security (RLS)**
   - Lista de todas as tabelas com status RLS (Ativo/Inativo)
   - DELETE restrito para anon (status: Ativo)
   - Views publicas sem campos sensiveis (status: Ativo)

4. **Edge Functions**
   - `admin-validate`: Protegida com JWT + role check (status: Ativo)
   - `get-manager-details`: Protegida com JWT admin (status: Ativo)
   - `get-driver-details`: SEM autenticacao para dados bancarios (status: Critico)
   - `get-signed-url`: SEM autenticacao (status: Critico)

5. **Storage**
   - Bucket `driver-avatars`: Publico (status: OK - intencional)
   - Bucket `driver-documents`: Privado (status: Ativo)
   - Acesso via signed URLs (status: Ativo, mas sem auth no endpoint)

6. **Dados Sensiveis**
   - Senhas nao trafegam em listagens (status: Ativo)
   - Dados bancarios via Edge Function (status: Parcial)
   - Documentos via signed URLs (status: Ativo)

7. **Recomendacoes**
   - Lista priorizada de acoes pendentes

### Arquivos
- `src/pages/admin/SecurityPage.tsx` (nova pagina)

---

## Parte 4: Alteracoes Tecnicas

### Novos arquivos
1. `src/pages/admin/AdminOverviewPage.tsx`
2. `src/pages/admin/SecurityPage.tsx`

### Arquivos modificados
1. `src/components/admin/AdminSidebar.tsx` - Adicionar 2 novos itens no menu (Visao Geral e Seguranca)
2. `src/App.tsx` - Adicionar 2 novas rotas admin
3. `supabase/functions/get-signed-url/index.ts` - Adicionar validacao basica
4. `supabase/functions/get-driver-details/index.ts` - Exigir autenticacao para dados bancarios
5. `supabase/functions/admin-validate/index.ts` - Padronizar CORS headers

### Ordem de implementacao
1. Corrigir vulnerabilidades nas Edge Functions
2. Criar pagina AdminOverviewPage com filtros e graficos
3. Criar pagina SecurityPage com auditoria completa
4. Atualizar sidebar e rotas
5. Testar fluxos end-to-end

