import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isValidTbrCode } from "@/lib/utils";
import { isBarcodeInsideViewfinder } from "@/lib/scanner-utils";
import { cn } from "@/lib/utils";

export interface ScanEntry {
  code: string;
  status: "success" | "error" | "duplicate";
  timestamp: Date;
  attemptCount: number;
}

interface TbrScannerProps {
  /** Called when a valid TBR is scanned. Return true for success, throw/return false for error. */
  onScan: (code: string) => Promise<boolean>;
  /** Placeholder for the manual input */
  placeholder?: string;
  /** Disable the scanner */
  disabled?: boolean;
}

const playBeep = (freq: number, duration: number, type: OscillatorType = "sine") => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
};

const TbrScanner = ({ onScan, placeholder = "Digite ou bipe o TBR...", disabled }: TbrScannerProps) => {
  const [input, setInput] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanEntry[]>([]);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedCodesRef = useRef<Map<string, number>>(new Map());
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const showFeedback = (type: "success" | "error") => {
    setFeedback(type);
    setTimeout(() => setFeedback(null), 800);
  };

  const processCode = useCallback(async (rawCode: string) => {
    const code = rawCode.toUpperCase().trim();
    if (!code) return;

    if (!isValidTbrCode(code)) {
      playBeep(300, 0.3, "square");
      showFeedback("error");
      setScanHistory((prev) => [
        { code, status: "error", timestamp: new Date(), attemptCount: 1 },
        ...prev,
      ]);
      return;
    }

    const attempts = (processedCodesRef.current.get(code) ?? 0) + 1;
    processedCodesRef.current.set(code, attempts);

    if (attempts > 1) {
      // Already processed — show as duplicate but still record in history
      playBeep(300, 0.3, "square");
      showFeedback("error");
      setScanHistory((prev) => [
        { code, status: "duplicate", timestamp: new Date(), attemptCount: attempts },
        ...prev,
      ]);
      return;
    }

    setIsProcessing(true);
    try {
      const result = await onScanRef.current(code);
      if (result) {
        playBeep(880, 0.15);
        showFeedback("success");
        setScanHistory((prev) => [
          { code, status: "success", timestamp: new Date(), attemptCount: 1 },
          ...prev,
        ]);
      } else {
        // Reset so they can try again
        processedCodesRef.current.delete(code);
        playBeep(300, 0.3, "square");
        showFeedback("error");
        setScanHistory((prev) => [
          { code, status: "error", timestamp: new Date(), attemptCount: 1 },
          ...prev,
        ]);
      }
    } catch {
      processedCodesRef.current.delete(code);
      playBeep(300, 0.3, "square");
      showFeedback("error");
      setScanHistory((prev) => [
        { code, status: "error", timestamp: new Date(), attemptCount: 1 },
        ...prev,
      ]);
    } finally {
      setIsProcessing(false);
      setInput("");
      inputRef.current?.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      processCode(input.trim());
    }
  };

  // Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setShowCamera(true);
    } catch {
      // Camera access denied or unavailable
    }
  }, []);

  // Attach stream to video element once it's rendered
  useEffect(() => {
    if (!showCamera || !streamRef.current) return;

    const attachStream = async () => {
      // Wait a tick for the video element to mount
      await new Promise((r) => setTimeout(r, 50));
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }

      if (!("BarcodeDetector" in window)) return;

      const detector = new (window as any).BarcodeDetector({
        formats: ["data_matrix", "qr_code", "code_128", "code_39", "pdf417", "ean_13", "ean_8"],
      });

      const recentCodes = new Set<string>();

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length === 0) return;

          const vw = videoRef.current.videoWidth;
          const vh = videoRef.current.videoHeight;
          const vfLeft = vw * 0.35;
          const vfRight = vw * 0.65;
          const vfTop = vh * 0.15;
          const vfBottom = vh * 0.45;

          const tbrBarcodes = barcodes.filter((b: any) => {
            if (!b.rawValue.toUpperCase().startsWith("TBR")) return false;
            const bb = b.boundingBox;
            if (!bb) return false;
            return bb.x >= vfLeft && bb.y >= vfTop && bb.x + bb.width <= vfRight && bb.y + bb.height <= vfBottom;
          });

          if (tbrBarcodes.length !== 1) return;

          const code = tbrBarcodes[0].rawValue.toUpperCase();
          if (recentCodes.has(code)) return;
          recentCodes.add(code);
          setTimeout(() => recentCodes.delete(code), 5000);

          await processCode(code);
        } catch {}
      }, 100);
    };

    attachStream();

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [showCamera, processCode]);

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  useEffect(() => () => stopCamera(), []);

  const getEntryColor = (entry: ScanEntry) => {
    if (entry.status === "error" || entry.status === "duplicate") {
      if (entry.attemptCount >= 5) return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30";
      return "bg-destructive/10 text-destructive border-destructive/20";
    }
    return "bg-green-500/15 text-green-700 border-green-500/30";
  };

  return (
    <div className="space-y-3">
      {/* Manual input + camera toggle */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isProcessing}
          className="font-mono uppercase"
          autoFocus
        />
        <Button
          size="icon"
          variant={showCamera ? "destructive" : "outline"}
          onClick={showCamera ? stopCamera : startCamera}
          disabled={disabled}
        >
          {showCamera ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        </Button>
      </div>

      {/* Camera view */}
      {showCamera && (
        <div className="relative rounded-lg overflow-hidden bg-foreground/95 aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

          {/* Dark overlay outside viewfinder */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Semi-transparent dark overlay */}
            <div className="absolute inset-0 bg-black/50" />
            {/* Clear viewfinder cutout - 30% width, at 25% from top */}
            <div
              className="absolute bg-transparent"
              style={{
                left: "35%",
                top: "15%",
                width: "30%",
                height: "30%",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                borderRadius: "8px",
              }}
            />
            {/* Viewfinder border */}
            <div
              className="absolute border-2 border-white/70 rounded-lg"
              style={{ left: "35%", top: "15%", width: "30%", height: "30%" }}
            />
            {/* Corner accents */}
            <div className="absolute" style={{ left: "35%", top: "15%", width: "30%", height: "30%" }}>
              <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-white rounded-br-lg" />
            </div>
            {/* Scanning line animation */}
            <div
              className="absolute animate-scan"
              style={{ left: "36%", width: "28%", top: "15%", height: "30%" }}
            >
              <div className="absolute w-full h-0.5 bg-primary/60 shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
            </div>
          </div>

          {/* Feedback overlay */}
          {feedback && (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center pointer-events-none z-10 transition-opacity",
                feedback === "success" ? "bg-green-500/25" : "bg-red-500/15"
              )}
            >
              <div
                className={cn(
                  "rounded-full p-4 animate-[scale-in_0.3s_ease-out]",
                  feedback === "success" ? "bg-green-500/80" : "bg-red-500/60"
                )}
              >
                {feedback === "success" ? (
                  <Check className="h-12 w-12 text-white" strokeWidth={3} />
                ) : (
                  <X className="h-12 w-12 text-white" strokeWidth={3} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">Processando...</p>
      )}

      {/* Scan history */}
      {scanHistory.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Package className="h-3 w-3" />
            <span>{scanHistory.length} leitura{scanHistory.length !== 1 ? "s" : ""} nesta sessão</span>
          </div>
          <ScrollArea className="max-h-40">
            <div className="space-y-1">
              {scanHistory.map((entry, i) => (
                <div
                  key={`${entry.code}-${i}`}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs font-mono",
                    getEntryColor(entry)
                  )}
                >
                  <span className="font-bold">{entry.code}</span>
                  <div className="flex items-center gap-1.5">
                    {entry.attemptCount > 1 && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {entry.attemptCount}x
                      </Badge>
                    )}
                    {entry.status === "success" && <Check className="h-3 w-3" />}
                    {entry.status !== "success" && <X className="h-3 w-3" />}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default TbrScanner;
