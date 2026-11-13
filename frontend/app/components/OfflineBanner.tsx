"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, CheckCircle2 } from "lucide-react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 2800);
      return () => clearTimeout(timer);
    };

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        pointerEvents: "none",
        animation: "bannerSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          borderRadius: "9999px",
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.02em",
          boxShadow: isOffline
            ? "0 8px 32px rgba(244, 63, 94, 0.25), 0 0 0 1px rgba(244, 63, 94, 0.4)"
            : "0 8px 32px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.4)",
          background: isOffline
            ? "rgba(20, 10, 15, 0.94)"
            : "rgba(10, 24, 18, 0.94)",
          backdropFilter: "blur(12px)",
          color: isOffline ? "#fda4af" : "#6ee7b7",
          transition: "all 0.3s ease",
        }}
      >
        {isOffline ? (
          <>
            <WifiOff size={14} style={{ animation: "pulse 1.5s infinite" }} />
            <span>Network offline — Attempting to reconnect...</span>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} />
            <span>Connection restored — Back online</span>
          </>
        )}
      </div>

      <style>{`
        @keyframes bannerSlideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
