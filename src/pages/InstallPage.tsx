import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LogoHeader from "@/components/LogoHeader";
import { Download, Share, MoreVertical, CheckCircle2, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

const InstallPage = () => {
  const { canInstall, isInstalled, isIOS, install } = usePwaInstall();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-md space-y-6">
        <LogoHeader size="lg" />

        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Instalar Sistema FVL</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tenha acesso rápido direto da tela inicial do seu celular
          </p>
        </div>

        {isInstalled ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <p className="font-semibold text-foreground">App já instalado!</p>
              <p className="text-sm text-muted-foreground">
                O Sistema FVL já está na sua tela inicial.
              </p>
              <Button className="w-full mt-4" onClick={() => navigate("/")}>
                Ir para o Sistema
              </Button>
            </CardContent>
          </Card>
        ) : canInstall ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-5 w-5" />
                Instalação Rápida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para instalar o app na sua tela inicial.
              </p>
              <Button className="w-full" size="lg" onClick={install}>
                <Download className="mr-2 h-4 w-4" />
                Instalar App
              </Button>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-5 w-5" />
                Como instalar no iPhone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium">Toque no botão Compartilhar</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Share className="h-3 w-3" /> na barra inferior do Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                  <p className="text-sm font-medium">Toque em "Adicionar à Tela de Início"</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                  <p className="text-sm font-medium">Toque em "Adicionar"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-5 w-5" />
                Como instalar no Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium">Toque no menu do navegador</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MoreVertical className="h-3 w-3" /> (três pontos no canto superior)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                  <p className="text-sm font-medium">Toque em "Instalar app" ou "Adicionar à tela inicial"</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                  <p className="text-sm font-medium">Confirme a instalação</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
          Voltar ao login
        </Button>
      </div>
    </div>
  );
};

export default InstallPage;
