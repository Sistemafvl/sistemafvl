import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Trash2, Loader2, Save, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DriverDoc {
  id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

const DOC_TYPES = [
  { value: "cnh", label: "CNH" },
  { value: "crlv", label: "CRLV" },
  { value: "comprovante_endereco", label: "Comprovante de Endereço" },
];

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave Aleatória" },
];

const DriverDocuments = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;

  const [docs, setDocs] = useState<DriverDoc[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Banking fields
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyName, setPixKeyName] = useState("");
  const [pixKeyType, setPixKeyType] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    const fetchData = async () => {
      setLoading(true);
      const [docsRes, driverRes] = await Promise.all([
        supabase.from("driver_documents").select("*").eq("driver_id", driverId).order("created_at", { ascending: false }),
        supabase.from("drivers").select("bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type").eq("id", driverId).maybeSingle(),
      ]);
      setDocs((docsRes.data as any) ?? []);
      if (driverRes.data) {
        const d = driverRes.data as any;
        setBankName(d.bank_name ?? "");
        setBankAgency(d.bank_agency ?? "");
        setBankAccount(d.bank_account ?? "");
        setPixKey(d.pix_key ?? "");
        setPixKeyName(d.pix_key_name ?? "");
        setPixKeyType(d.pix_key_type ?? "");
      }
      setLoading(false);
    };
    fetchData();
  }, [driverId]);

  const getSignedUrl = async (path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { path, bucket: "driver-documents" },
      });
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  };

  const handleUpload = async (docType: string, file: File) => {
    if (!driverId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 5MB.", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext ?? "")) {
      toast({ title: "Formato inválido", description: "Use PDF, PNG ou JPG.", variant: "destructive" });
      return;
    }
    setUploading(docType);
    const path = `${driverId}/${docType}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("driver-documents").upload(path, file);
    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    // Store the storage path (not public URL since bucket is now private)
    const fileUrl = path;

    // Delete previous doc of same type
    const existing = docs.find((d) => d.doc_type === docType);
    if (existing) {
      await supabase.from("driver_documents").delete().eq("id", existing.id);
    }

    await supabase.from("driver_documents").insert({
      driver_id: driverId,
      doc_type: docType,
      file_url: fileUrl,
      file_name: file.name,
    } as any);

    const { data: refreshed } = await supabase.from("driver_documents").select("*").eq("driver_id", driverId).order("created_at", { ascending: false });
    setDocs((refreshed as any) ?? []);
    setUploading(null);
    toast({ title: "Documento enviado!", description: `${DOC_TYPES.find((d) => d.value === docType)?.label} atualizado.` });
  };

  const handleDeleteDoc = async (doc: DriverDoc) => {
    await supabase.from("driver_documents").delete().eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast({ title: "Documento removido" });
  };

  const handleSaveBank = async () => {
    if (!driverId) return;
    setSavingBank(true);
    await supabase.from("drivers").update({
      bank_name: bankName || null,
      bank_agency: bankAgency || null,
      bank_account: bankAccount || null,
      pix_key: pixKey || null,
      pix_key_name: pixKeyName || null,
      pix_key_type: pixKeyType || null,
    } as any).eq("id", driverId);
    setSavingBank(false);
    setBankSaved(true);
    setTimeout(() => setBankSaved(false), 2000);
    toast({ title: "Dados bancários salvos!" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        Documentos
      </h1>

      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic">Upload de Documentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DOC_TYPES.map((dt) => {
            const existing = docs.find((d) => d.doc_type === dt.value);
            return (
              <div key={dt.value} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{dt.label}</p>
                  {existing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <button
                        onClick={async () => {
                          const url = await getSignedUrl(existing.file_url);
                          if (url) window.open(url, "_blank");
                          else toast({ title: "Erro ao abrir documento", variant: "destructive" });
                        }}
                        className="text-xs text-primary underline truncate cursor-pointer bg-transparent border-none p-0"
                      >
                        {existing.file_name}
                      </button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteDoc(existing)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Nenhum arquivo enviado</p>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(dt.value, file);
                      e.target.value = "";
                    }}
                    disabled={uploading === dt.value}
                  />
                  <Button size="sm" variant="outline" asChild disabled={uploading === dt.value}>
                    <span>
                      {uploading === dt.value ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                      {existing ? "Substituir" : "Enviar"}
                    </span>
                  </Button>
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Banking Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold italic">Dados Bancários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Banco</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ex: Nubank, Itaú..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Agência</Label>
              <Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} placeholder="Ex: 0001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Conta</Label>
              <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Ex: 12345-6" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Chave Pix</Label>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {PIX_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Chave Pix</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave pix..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome do Titular</Label>
              <Input value={pixKeyName} onChange={(e) => setPixKeyName(e.target.value)} placeholder="Nome do titular da conta" />
            </div>
          </div>
          <Button onClick={handleSaveBank} disabled={savingBank} className="w-full">
            {savingBank ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : bankSaved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {bankSaved ? "Salvo!" : "Salvar Dados Bancários"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverDocuments;
