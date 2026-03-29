import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Scale, Save, Eye, Edit3, Loader2, CheckCircle2, Users, Clock, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const getDefaultContract = (domainName: string) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE E ENTREGAS

CONTRATANTE: ${domainName} Prestação de Serviços Logísticos Ltda.

CONTRATADO(A): Motorista Parceiro(a) devidamente cadastrado no sistema digital da CONTRATANTE.

---

1. DO OBJETO
O presente instrumento tem por objeto a prestação de serviços de transporte e entrega de mercadorias (última milha/last-mile) pelo CONTRATADO à CONTRATANTE, de forma eventual e sem exclusividade, conforme demandas operacionais disponibilizadas pelo sistema digital da CONTRATANTE.

2. DA AUTONOMIA E VÍNCULO EMPREGATÍCIO
As partes declaram expressamente que este contrato não estabelece qualquer vínculo empregatício entre o CONTRATADO e a CONTRATANTE, nos termos da Lei nº 11.442/2007 e da Lei nº 13.467/2017 (Reforma Trabalhista). O CONTRATADO é profissional autônomo, detendo plena liberdade na execução de suas atividades, podendo inclusive prestar serviços a terceiros.

3. DAS OBRIGAÇÕES DO CONTRATADO
a) Manter o veículo em perfeitas condições de uso, segurança e higiene;
b) Portar CNH válida (categoria compatível) e toda a documentação do veículo em dia;
c) Utilizar os equipamentos de proteção individual (EPIs) quando exigido pela operação;
d) Zelar pela integridade das mercadorias transportadas durante todo o percurso;
e) Efetuar a baixa das entregas em tempo real via sistema mobile da CONTRATANTE;
f) Comparecer ao ponto de carregamento nos horários estipulados pela unidade operacional;
g) Comunicar imediatamente qualquer ocorrência, avaria ou extravio de mercadorias;
h) Manter seus dados cadastrais atualizados no sistema.

4. DAS OBRIGAÇÕES DA CONTRATANTE
a) Disponibilizar as rotas e pacotes para entrega por meio do sistema digital;
b) Efetuar os pagamentos nos prazos e valores acordados;
c) Fornecer acesso ao sistema de gestão de entregas e conferência;
d) Prestar suporte operacional por meio da equipe da unidade.

5. DA REMUNERAÇÃO
A remuneração será composta por valor fixo por pacote entregue com sucesso (TBR), conforme tabela vigente no sistema. Os pagamentos serão realizados quinzenalmente, após a conciliação dos relatórios gerados pelo sistema e aprovação da diretoria da unidade. Valores referentes a DNR (Devoluções Não Realizadas) e Reativos poderão ser descontados conforme regras operacionais vigentes.

6. DA RESPONSABILIDADE CIVIL
O CONTRATADO responde civilmente por eventuais danos causados a terceiros ou às mercadorias durante a execução dos serviços, bem como por multas de trânsito decorrentes de sua conduta. Em caso de extravio ou dano às mercadorias por culpa comprovada, o CONTRATADO poderá ter os valores correspondentes descontados de sua remuneração.

7. DA CONFIDENCIALIDADE
O CONTRATADO compromete-se a manter sigilo absoluto sobre todas as informações obtidas em razão da prestação dos serviços, incluindo dados de clientes, rotas, volumes e demais informações operacionais da CONTRATANTE, sob pena de responsabilização civil e criminal.

8. DA PROTEÇÃO DE DADOS (LGPD)
Em conformidade com a Lei nº 13.709/2018 (LGPD), o CONTRATADO autoriza a coleta e tratamento de seus dados pessoais exclusivamente para fins operacionais, cadastrais e financeiros relacionados à prestação dos serviços. A CONTRATANTE compromete-se a proteger os dados pessoais do CONTRATADO, utilizando-os apenas para as finalidades previstas neste contrato.

9. DO USO DO SISTEMA DIGITAL
O CONTRATADO receberá credenciais de acesso ao sistema digital da CONTRATANTE, sendo de sua inteira responsabilidade a guarda e o uso adequado dessas credenciais. O login é pessoal e intransferível. O uso indevido do sistema poderá acarretar o desligamento imediato e responsabilização nas esferas cível e criminal.

10. DAS PENALIDADES
O descumprimento das obrigações previstas neste contrato poderá acarretar:
a) Advertência verbal ou por escrito;
b) Suspensão temporária do acesso ao sistema e às rotas;
c) Rescisão imediata do contrato, sem aviso prévio, em casos graves.

11. DA RESCISÃO
Este contrato poderá ser rescindido por qualquer uma das partes, a qualquer tempo, mediante aviso prévio de 24 (vinte e quatro) horas, sem ônus, exceto em casos de má conduta, fraude ou descumprimento grave das cláusulas aqui pactuadas, hipóteses em que a rescisão será imediata.

12. DAS DISPOSIÇÕES GERAIS
a) Este contrato é regido pelas leis da República Federativa do Brasil;
b) Os casos omissos serão resolvidos de comum acordo entre as partes;
c) A tolerância de qualquer das partes quanto ao descumprimento de cláusulas não implica renúncia ao direito de exigi-las;
d) O aceite digital deste contrato tem a mesma validade jurídica da assinatura física, nos termos da MP 2.200-2/2001.

13. DO FORO
Fica eleito o Foro da Comarca da Sede da Contratante para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`;

interface DriverAcceptance {
  driver_id: string;
  driver_name: string;
  accepted_at: string | null;
}

const ContractEditorPage = () => {
  const { unitSession } = useAuthStore();
  const [content, setContent] = useState("");
  const domainName = unitSession?.domain_name || "Empresa";
  const [title, setTitle] = useState(`Contrato de Prestação de Serviços - ${domainName}`);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const [acceptances, setAcceptances] = useState<DriverAcceptance[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [loadingAcceptances, setLoadingAcceptances] = useState(false);

  useEffect(() => {
    fetchLatestContract();
  }, []);

  useEffect(() => {
    if (currentContractId) {
      fetchAcceptances();
    }
  }, [currentContractId]);

  const fetchLatestContract = async () => {
    setFetching(true);
    const domainId = unitSession?.domain_id;
    const query = (supabase.from("contracts" as any) as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (domainId) query.eq("domain_id", domainId);
    const { data } = await query.single();

    if (data) {
      setContent(data.content);
      setTitle(data.title);
      setCurrentContractId(data.id);
    } else {
      setContent(getDefaultContract(domainName));
    }
    setFetching(false);
  };

  const fetchAcceptances = async () => {
    if (!currentContractId || !unitSession?.domain_id) return;
    setLoadingAcceptances(true);

    // Get all units from the same domain
    const { data: domainUnits } = await supabase
      .from("units")
      .select("id")
      .eq("domain_id", unitSession.domain_id);

    if (!domainUnits?.length) { setLoadingAcceptances(false); return; }
    const unitIds = domainUnits.map(u => u.id);

    // Get unique drivers from driver_rides in those units
    const { data: rides } = await supabase
      .from("driver_rides")
      .select("driver_id")
      .in("unit_id", unitIds);

    const uniqueDriverIds = [...new Set((rides || []).map(r => r.driver_id))];
    if (!uniqueDriverIds.length) { setLoadingAcceptances(false); return; }

    // Get driver names
    const { data: drivers } = await supabase
      .from("drivers_public")
      .select("id, name")
      .in("id", uniqueDriverIds);

    // Get acceptances for current contract
    const { data: contractAcceptances } = await (supabase as any)
      .from("driver_contracts")
      .select("driver_id, accepted_at")
      .eq("contract_id", currentContractId);

    const acceptanceMap = new Map<string, string>();
    (contractAcceptances || []).forEach((a: any) => acceptanceMap.set(a.driver_id, a.accepted_at));

    const result: DriverAcceptance[] = (drivers || []).map((d: any) => ({
      driver_id: d.id,
      driver_name: d.name || "Sem nome",
      accepted_at: acceptanceMap.get(d.id) || null,
    }));

    // Sort: pending first, then by name
    result.sort((a, b) => {
      if (!a.accepted_at && b.accepted_at) return -1;
      if (a.accepted_at && !b.accepted_at) return 1;
      return a.driver_name.localeCompare(b.driver_name);
    });

    setAcceptances(result);
    setLoadingAcceptances(false);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast({ title: "Erro", description: "O conteúdo do contrato não pode estar vazio.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase.from("contracts" as any) as any).insert([{ title, content, domain_id: unitSession?.domain_id }]).select().single();
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contrato salvo!", description: "Uma nova versão do contrato foi publicada para os motoristas." });
      if (data) {
        setCurrentContractId(data.id);
      }
    }
  };

  const acceptedCount = acceptances.filter(a => a.accepted_at).length;
  const pendingCount = acceptances.filter(a => !a.accepted_at).length;
  const filteredAcceptances = acceptances.filter(a =>
    a.driver_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

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
              <CardContent className="p-8 markdown-content">
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
              <CardTitle className="text-sm font-bold italic">Como Editar</CardTitle>
              <CardDescription className="text-xs">Simples e rápido!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>✏️ Edite o texto diretamente na área ao lado</p>
              <p>👁️ Use o botão "Prévia" para visualizar como ficará</p>
              <p>💾 Clique em "Salvar e Publicar" quando estiver pronto</p>
              <p>📲 O contrato será enviado automaticamente aos motoristas</p>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4 text-[10px] uppercase font-black tracking-widest text-primary hover:bg-primary/10"
                onClick={() => setContent(getDefaultContract(domainName))}
              >
                Restaurar Modelo Padrão
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

      {/* Painel de Aceites dos Motoristas */}
      {currentContractId && (
        <Card className="border-2 border-muted">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-bold italic">Aceites dos Motoristas</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-green-600 text-white gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {acceptedCount} aceitos
                </Badge>
                <Badge variant="outline" className="border-amber-500 text-amber-700 gap-1">
                  <Clock className="h-3 w-3" /> {pendingCount} pendentes
                </Badge>
              </div>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar motorista..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loadingAcceptances ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-primary" />
              </div>
            ) : filteredAcceptances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 italic">
                {acceptances.length === 0 ? "Nenhum motorista encontrado nas unidades deste domínio." : "Nenhum resultado para a busca."}
              </p>
            ) : (
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {filteredAcceptances.map((driver) => (
                  <div key={driver.driver_id} className="flex items-center justify-between py-2.5 px-1">
                    <span className="text-sm font-medium truncate max-w-[200px]">{driver.driver_name}</span>
                    {driver.accepted_at ? (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-semibold">{format(new Date(driver.accepted_at), "dd/MM/yy HH:mm")}</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 font-bold">
                        PENDENTE
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
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
