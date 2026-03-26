import { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

declare const __BUILD_VERSION__: string;

const VersionSyncControl = () => {
  const [loading, setLoading] = useState(false);

  const buildVersion = typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "?";
  const short = buildVersion.slice(-6);

  const isPreview =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");

  const handleClearCache = async () => {
    setLoading(true);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        for (const k of keys) await caches.delete(k);
      }
      toast({
        title: "Cache limpo!",
        description: "A página irá recarregar.",
      });
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error("Cache purge failed:", err);
      toast({ title: "Erro", description: "Falha ao sincronizar.", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-[10px] text-muted-foreground h-7 px-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
        onClick={handleClearCache}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        <span className="hidden sm:inline">SINCRONIZAR</span>
      </Button>
      <span className="text-[9px] text-muted-foreground/50 font-mono hidden sm:inline">
        {isPreview ? "DEV" : "PROD"} · {short}
      </span>
    </div>
  );
};

export default VersionSyncControl;
