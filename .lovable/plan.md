

# Plano: 2 Correções — Edge Function get-signed-url + Registro sem documentos

## 1. Corrigir ZIP vazio — Edge Function `get-signed-url`

**Arquivo:** `supabase/functions/get-signed-url/index.ts`

**Problema:** Quando o gerente (usando token anon) tenta baixar documentos, o token é diferente do `SUPABASE_ANON_KEY` (pode ser a publishable key). O código entra no bloco `getUser()`, que falha porque não é um JWT de usuário real, e retorna 401 imediatamente. O ZIP sai vazio porque nenhuma URL assinada é gerada.

**Solução:** Remover o `return 401` quando `getUser` falha. Em vez disso, deixar `isAuthenticated = false` e permitir que o fluxo continue para o bloco de verificação do motorista no banco.

Linhas 53-59, de:
```typescript
if (userError || !userData?.user) {
  return new Response(
    JSON.stringify({ error: "Invalid token" }),
    { status: 401, ... }
  );
}
```

Para:
```typescript
if (!userError && userData?.user) {
  isAuthenticated = true;
}
```

Isso remove o `isAuthenticated = true` separado (linha 60) e consolida num único bloco condicional.

---

## 2. Proteção server-side contra cadastro sem documentos

**Arquivo:** `src/components/DriverRegistrationModal.tsx`

**Problema:** O Márcio cadastrou antes do deploy da validação. A validação front-end atual já funciona (botão desabilitado + check no submit). Porém, para prevenir bypasses futuros, vamos adicionar uma verificação extra pós-insert: se o upload de documentos falhar para algum obrigatório, o motorista inserido é deletado (rollback manual).

**Alteração:** Após o loop de upload dos documentos (linhas 152-165), verificar se todos os 3 documentos obrigatórios foram uploadados com sucesso. Se não, deletar o registro do motorista e mostrar erro.

```typescript
// Após uploads, verificar se os obrigatórios foram salvos
const { count } = await supabase
  .from("driver_documents")
  .select("id", { count: "exact", head: true })
  .eq("driver_id", driverId)
  .in("doc_type", ["cnh", "crlv", "comprovante_endereco"]);

if ((count ?? 0) < 3) {
  // Rollback: deletar motorista
  await supabase.from("drivers").delete().eq("id", driverId);
  await supabase.from("driver_documents").delete().eq("driver_id", driverId);
  toast({ title: "Erro no upload", description: "Falha ao enviar documentos obrigatórios. Tente novamente.", variant: "destructive" });
  setLoading(false);
  return;
}
```

---

## Resumo

| Arquivo | Alteração |
|---|---|
| `supabase/functions/get-signed-url/index.ts` | Remover return 401 no fallback de getUser, permitir verificação via driver_id |
| `src/components/DriverRegistrationModal.tsx` | Rollback server-side se documentos obrigatórios falharem no upload |

