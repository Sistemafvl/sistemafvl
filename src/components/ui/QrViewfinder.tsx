/**
 * QR-code style viewfinder overlay for camera scanners.
 * Place inside a relative-positioned container that wraps the <video>.
 */
const QrViewfinder = () => (
  <div className="absolute inset-0 pointer-events-none">
    {/* Semi-transparent dark overlay */}
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
    {/* QR-style corner brackets + inner patterns */}
    <div className="absolute" style={{ left: "20%", top: "20%", width: "60%", height: "60%" }}>
      {/* Corners */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-primary rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-primary rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-primary rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-primary rounded-br-sm" />

      {/* QR finder pattern squares */}
      <div className="absolute top-1.5 left-1.5 w-4 h-4 border-2 border-primary/40 rounded-sm" />
      <div className="absolute top-1.5 right-1.5 w-4 h-4 border-2 border-primary/40 rounded-sm" />
      <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-2 border-primary/40 rounded-sm" />

      {/* Scanning line */}
      <div className="absolute inset-x-1 animate-scan" style={{ top: "0%", height: "100%" }}>
        <div className="absolute w-full h-0.5 bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
      </div>
    </div>

    {/* Label */}
    <div className="absolute bottom-[12%] left-0 right-0 text-center">
      <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">Posicione o código no quadro</span>
    </div>
  </div>
);

export default QrViewfinder;
