import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, Check, Package } from "lucide-react";
import QrViewfinder from "@/components/ui/QrViewfinder";
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
          const vfLeft = vw * 0.20;
          const vfRight = vw * 0.80;
          const vfTop = vh * 0.20;
          const vfBottom = vh * 0.80;

          const insideBarcodes = barcodes.filter((b: any) => {
            const bb = b.boundingBox;
            if (!bb) return false;
            return bb.x >= vfLeft && bb.y >= vfTop && bb.x + bb.width <= vfRight && bb.y + bb.height <= vfBottom;
          });

          if (insideBarcodes.length !== 1) return;

          const code = insideBarcodes[0].rawValue?.trim().toUpperCase();
          if (!code) return;

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
        <div className="relative rounded-lg overflow-hidden bg-foreground/95 aspect-square max-w-xs mx-auto">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

          {/* Dark overlay with square QR-code viewfinder cutout */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-black/50" />
            {/* Square cutout centered — 60% of container */}
            <div
              className="absolute bg-transparent"
              style={{
                left: "20%",
                top: "20%",
                width: "60%",
                height: "60%",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                borderRadius: "4px",
              }}
            />
            {/* QR-style corner brackets */}
            <div className="absolute" style={{ left: "20%", top: "20%", width: "60%", height: "60%" }}>
              {/* Top-left */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-primary rounded-tl-sm" />
              {/* Top-right */}
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-primary rounded-tr-sm" />
              {/* Bottom-left */}
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-primary rounded-bl-sm" />
              {/* Bottom-right */}
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-primary rounded-br-sm" />

              {/* QR finder pattern squares (top-left, top-right, bottom-left) */}
              <div className="absolute top-1.5 left-1.5 w-4 h-4 border-2 border-primary/40 rounded-sm" />
              <div className="absolute top-1.5 right-1.5 w-4 h-4 border-2 border-primary/40 rounded-sm" />
              <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-2 border-primary/40 rounded-sm" />

              {/* Scanning line that bounces up and down */}
              <div className="absolute inset-x-1 animate-scan" style={{ top: "0%", height: "100%" }}>
                <div className="absolute w-full h-0.5 bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
              </div>
            </div>

            {/* Label */}
            <div className="absolute bottom-[12%] left-0 right-0 text-center">
              <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">Posicione o código no quadro</span>
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
