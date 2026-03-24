import React, { useEffect } from "react";

interface AdBannerProps {
  adClient?: string;
  adSlot?: string;
  className?: string;
}

/**
 * Component to display Google Ads.
 * Note: You must replace the placeholders with your actual adClient and adSlot from Google AdSense.
 */
const AdBanner = ({ adClient = "ca-pub-6544232309154364", adSlot = "8290648709", className = "" }: AdBannerProps) => {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("Adsbygoogle error:", e);
    }
  }, []);

  return (
    <div className={`ad-container my-4 overflow-hidden border border-border/10 rounded-xl bg-white/5 flex flex-col items-center justify-center p-2 h-[100px] max-h-[100px] shadow-sm ${className}`}>
      <span className="text-[10px] text-muted-foreground/30 uppercase tracking-widest mb-1">Anúncio</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdBanner;
