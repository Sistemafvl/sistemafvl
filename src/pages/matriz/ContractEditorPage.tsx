import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Scale, Save, Eye, Edit3, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ContractEditorPage = () => {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("Contrato de Prestação de Serviços - Favela Llog");
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchLatestContract();
  }, []);

  const fetchLatestContract = async () => {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setContent(data.content);
      setTitle(data.title);
    }
    setFetching(false);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast({ title: "Erro", description: "O conteúdo do contrato não pode estar vazio.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("contracts").insert([{ title, content }]);
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contrato salvo!", description: "Uma nova versão do contrato foi publicada para os motoristas." });
    }
  };

  if (fetching) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold italic flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" /> Gestão de Contrato e Termos
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(!preview)} className="gap-2 italic font-semibold">
            {preview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? "Editar" : "Prévia"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-2 italic font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar e Publicar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {preview ? (
            <Card className="min-h-[600px] border-2 border-primary/20 shadow-lg animate-in fade-in duration-300">
              <CardContent className="p-8">
                <div className="whitespace-pre-wrap font-sans leading-relaxed text-slate-800">
                  {content || "_Sem conteúdo_"}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <Label className="text-xs font-bold uppercase italic text-muted-foreground ml-1">Título do Documento</Label>
                  <input 
                    className="w-full mt-1 bg-transparent border-0 border-b border-muted focus:ring-0 text-lg font-bold italic"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título do Contrato"
                  />
                </CardContent>
              </Card>
              <Card className="min-h-[500px]">
                <CardContent className="p-0">
                  <textarea 
                    className="w-full h-[600px] p-6 bg-transparent border-0 focus:ring-0 font-mono text-sm leading-relaxed resize-none"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escreva o contrato aqui..."
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>


        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold italic">Instruções de Edição</CardTitle>
              <CardDescription className="text-xs">Utilize Markdown para formatar o texto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p><strong># Título Principal</strong></p>
              <p><strong>## Subtítulo</strong></p>
              <p><strong>- Lista de itens</strong></p>
              <p><strong>**Negrito**</strong></p>
              <p><strong>---</strong> (Linha divisória)</p>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4 text-[10px] uppercase font-black tracking-widest text-primary hover:bg-primary/10"
                onClick={() => setContent("# NOVO CONTRATO\n\nDescreva os termos aqui...")}
              >
                Limpar e Iniciar Novo
              </Button>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <CardTitle className="text-sm font-bold italic text-green-700">Impacto Legal</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-[11px] text-green-800 italic leading-relaxed">
              Ao clicar em "Salvar e Publicar", todos os motoristas parceiros serão notificados da nova versão. 
              O sistema registrará o aceite individual com data, hora e IP do motorista.
            </CardContent>
          </Card>
        </div>
      </div>
      
      <style>{`
        .markdown-content h1 { font-size: 1.5rem; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
        .markdown-content h2 { font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 1rem; color: #1e293b; }
        .markdown-content p { margin-bottom: 1rem; line-height: 1.7; color: #334155; }
        .markdown-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
        .markdown-content li { margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
};

export default ContractEditorPage;
