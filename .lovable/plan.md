

# Tres Correcciones: Download NF, Camera Scanner PS, Avatar na Busca

## 1. Download de NF nao funciona (Financeiro)

**Problema**: O bucket `driver-documents` e privado. O `handleDownload` tenta `supabase.storage.from("driver-documents").createSignedUrl(...)` usando o client com role `anon`, mas o bucket privado nao permite isso sem RLS adequada. O fallback via edge function tambem pode falhar se a URL armazenada em `file_url` nao corresponder ao path correto.

**Solucao**: Remover a tentativa direta pelo client (que falha com bucket privado + anon) e usar diretamente a edge function `get-signed-url` que ja usa a service role key. O `file_url` armazenado pelo motorista ja e o storage path (ex: `driverId/nf_reportId_...`), entao basta passa-lo diretamente.

**Arquivo**: `src/pages/dashboard/FinanceiroPage.tsx` (linhas 91-134)
- Simplificar `handleDownload` para chamar diretamente a edge function `get-signed-url`
- Passar `bucket: "driver-documents"`, `path: storagePath`, `driver_id: driverId`

## 2. Camera Scanner para PS (Problem Solve)

**O que fazer**: Adicionar um botao de camera ao lado do input de TBR na pagina PS, identico ao da Conferencia de Carregamento. Ao escanear um TBR pela camera, abre o modal "Registrar Problem Solve" para aquele TBR.

**Arquivo**: `src/pages/dashboard/PSPage.tsx`
- Importar `BarcodeDetector` e reutilizar o mesmo padrao de camera da ConferenciaCarregamentoPage
- Adicionar botao de Camera ao lado direito do input (linha ~586-596)
- Ao detectar um codigo TBR, chamar `searchTbr(code)` que ja abre o modal PS
- Adicionar video overlay e controles de camera

## 3. Melhorar sensibilidade do scanner de camera

**Problema**: O intervalo de scan atual e `setInterval(..., 300)` (300ms) tanto na ConferenciaCarregamentoPage quanto sera no PSPage. Isso causa lentidao na leitura.

**Solucao**: Reduzir o intervalo para `100ms` e adicionar mais formatos de codigo de barras, alem de usar resolucao mais alta da camera.

**Arquivos**:
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (linha 287): Mudar `300` para `100`
- `src/pages/dashboard/PSPage.tsx`: Usar `100ms` no novo scanner
- Ambos: Adicionar `{ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } }` para maior resolucao
- Adicionar formatos extras: `"upc_a"`, `"upc_e"`, `"data_matrix"`, `"pdf417"`

## 4. Avatar/foto na busca de motorista (QueuePanel)

**Problema**: Na lista de resultados da busca por nome (linhas 449-459 do QueuePanel), mostra apenas texto sem a foto do motorista.

**Solucao**: Adicionar o Avatar do motorista ao lado do nome nos resultados de busca.

**Arquivo**: `src/components/dashboard/QueuePanel.tsx` (linhas 449-459)
- Adicionar `Avatar` com `AvatarImage` (usando `d.avatar_url`) e `AvatarFallback` antes do nome
- Reorganizar layout com `flex items-center gap-2`

## Detalhes Tecnicos

### FinanceiroPage.tsx - handleDownload simplificado

```typescript
const handleDownload = async (driverId: string) => {
  const inv = invoices[driverId];
  if (!inv) return;
  setDownloading(driverId);
  try {
    let storagePath = inv.file_url;
    if (storagePath.startsWith("http")) {
      const match = storagePath.match(/driver-documents\/(.+?)(\?|$)/);
      if (match) storagePath = decodeURIComponent(match[1]);
      else { toast({...}); return; }
    }
    const { data, error } = await supabase.functions.invoke("get-signed-url", {
      body: { bucket: "driver-documents", path: storagePath, driver_id: driverId },
    });
    if (error || !data?.signedUrl) {
      toast({ title: "Erro", description: "Erro ao gerar link de download.", variant: "destructive" });
    } else {
      window.open(data.signedUrl, "_blank");
    }
  } catch { toast({...}); }
  setDownloading(null);
};
```

### PSPage.tsx - Adicionar camera scanner

- Adicionar refs: `videoRef`, `streamRef`, `scanIntervalRef`, `cameraOpen` state
- Adicionar funcoes `startCameraScanner`, `stopCameraScanner`
- Botao de camera ao lado do input TBR
- Video overlay com ultimo codigo lido
- Ao ler TBR, chamar `searchTbr(code)` e parar camera

### Camera - Intervalo otimizado (ambos arquivos)

```typescript
// Resolucao maior
getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })

// Intervalo reduzido
setInterval(async () => { ... }, 100)

// Mais formatos
formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "codabar", "itf", "upc_a", "upc_e"]
```

### QueuePanel.tsx - Avatar nos resultados de busca

```tsx
<button key={d.id} onClick={...} className="w-full text-left p-2 rounded hover:bg-muted text-xs flex items-center gap-2">
  <Avatar className="h-8 w-8 shrink-0">
    {d.avatar_url && <AvatarImage src={d.avatar_url} />}
    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
      {d.name[0].toUpperCase()}
    </AvatarFallback>
  </Avatar>
  <div className="min-w-0">
    <p className="font-bold">{d.name}</p>
    <p className="text-muted-foreground">CPF: {maskCPF(d.cpf)} · {d.car_model} · {d.car_plate}</p>
  </div>
</button>
```

### Resumo de arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/FinanceiroPage.tsx` | Corrigir download NF usando edge function diretamente |
| `src/pages/dashboard/PSPage.tsx` | Adicionar camera scanner TBR + intervalo 100ms |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Reduzir intervalo scan para 100ms + resolucao maior |
| `src/components/dashboard/QueuePanel.tsx` | Adicionar avatar nos resultados de busca por nome |

