"use client";
import React, { useEffect, useRef, useState } from "react";
import { Check, Sparkles, User, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface PhotoCropperModalProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const VIEW_SIZE = 260; // 260px squircle preview
const CORNER_RADIUS = 32; // Matches 24px-28px profile squircle radius
const TARGET_SIZE = 256; // 256x256 crisp avatar export

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export default function PhotoCropperModal({
  imageSrc,
  onCrop,
  onCancel,
}: PhotoCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profileMiniCanvasRef = useRef<HTMLCanvasElement>(null);
  const navbarMiniCanvasRef = useRef<HTMLCanvasElement>(null);

  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1.15);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activePreset, setActivePreset] = useState<"face" | "bust" | "fit">("bust");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  // Smart Auto-Framing helper
  const applyPreset = (preset: "face" | "bust" | "fit", img?: HTMLImageElement | null) => {
    const currentImg = img || imageObj;
    if (!currentImg) return;

    setActivePreset(preset);
    const baseScale = Math.max(
      VIEW_SIZE / currentImg.naturalWidth,
      VIEW_SIZE / currentImg.naturalHeight
    );
    const isPortrait = currentImg.naturalHeight > currentImg.naturalWidth;

    if (preset === "face") {
      const z = 1.55;
      const totalH = currentImg.naturalHeight * baseScale * z;
      const targetPanY = isPortrait ? -(totalH - VIEW_SIZE) * 0.38 : -(totalH - VIEW_SIZE) * 0.2;
      setZoom(z);
      setPan({ x: 0, y: targetPanY });
    } else if (preset === "bust") {
      // Upper Body - Golden Ratio headroom
      const z = 1.18;
      const totalH = currentImg.naturalHeight * baseScale * z;
      const targetPanY = isPortrait ? -(totalH - VIEW_SIZE) * 0.22 : -(totalH - VIEW_SIZE) * 0.1;
      setZoom(z);
      setPan({ x: 0, y: targetPanY });
    } else if (preset === "fit") {
      // Fit full image
      const z = 0.95;
      setZoom(z);
      setPan({ x: 0, y: 0 });
    }
  };

  // Load image & trigger initial Smart Auto-Framing
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageObj(img);
      // Auto-Frame immediately on load (Upper Body Golden Ratio)
      applyPreset("bust", img);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Compute cover scale and generous bounded pan
  const getTransform = () => {
    if (!imageObj) return { baseScale: 1, totalScale: 1, clampedX: 0, clampedY: 0 };

    const baseScale = Math.max(
      VIEW_SIZE / imageObj.naturalWidth,
      VIEW_SIZE / imageObj.naturalHeight
    );
    const totalScale = baseScale * zoom;

    const currentW = imageObj.naturalWidth * totalScale;
    const currentH = imageObj.naturalHeight * totalScale;

    // Generous travel margin: allows moving at least 50% across the frame
    const maxPanX = Math.max(VIEW_SIZE * 0.55, (currentW - VIEW_SIZE) / 2 + 35);
    const maxPanY = Math.max(VIEW_SIZE * 0.55, (currentH - VIEW_SIZE) / 2 + 35);

    const clampedX = Math.max(-maxPanX, Math.min(maxPanX, pan.x));
    const clampedY = Math.max(-maxPanY, Math.min(maxPanY, pan.y));

    return { baseScale, totalScale, clampedX, clampedY, currentW, currentH };
  };

  // Render preview canvas and synchronize live mini-previews
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    const { totalScale, clampedX, clampedY } = getTransform();

    // Clip to exact squircle shape
    ctx.save();
    drawRoundedRect(ctx, 0, 0, VIEW_SIZE, VIEW_SIZE, CORNER_RADIUS);
    ctx.clip();

    // 1. Ambient blurred background fill (seamless edge extension)
    ctx.save();
    ctx.filter = "blur(16px) brightness(0.65)";
    const bgScale =
      Math.max(
        VIEW_SIZE / imageObj.naturalWidth,
        VIEW_SIZE / imageObj.naturalHeight
      ) * 1.35;
    ctx.translate(VIEW_SIZE / 2, VIEW_SIZE / 2);
    ctx.scale(bgScale, bgScale);
    ctx.drawImage(
      imageObj,
      -imageObj.naturalWidth / 2,
      -imageObj.naturalHeight / 2
    );
    ctx.restore();

    // 2. Crisp centered & panned main image
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(VIEW_SIZE / 2 + clampedX, VIEW_SIZE / 2 + clampedY);
    ctx.scale(totalScale, totalScale);
    ctx.drawImage(
      imageObj,
      -imageObj.naturalWidth / 2,
      -imageObj.naturalHeight / 2
    );
    ctx.restore();

    ctx.restore();

    // Update live mini-previews in real-time
    if (profileMiniCanvasRef.current) {
      const pCtx = profileMiniCanvasRef.current.getContext("2d");
      if (pCtx) {
        pCtx.clearRect(0, 0, 56, 56);
        pCtx.drawImage(canvas, 0, 0, 56, 56);
      }
    }
    if (navbarMiniCanvasRef.current) {
      const nCtx = navbarMiniCanvasRef.current.getContext("2d");
      if (nCtx) {
        nCtx.clearRect(0, 0, 30, 30);
        nCtx.drawImage(canvas, 0, 0, 30, 30);
      }
    }
  }, [imageObj, zoom, pan]);

  // Pointer drag events for smooth fluid panning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Scroll wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setZoom((prev) => Math.min(3, Math.max(0.85, +(prev + delta).toFixed(2))));
  };

  // Save crisp 256x256 squircle avatar
  const handleSave = () => {
    if (!imageObj) return;
    setSaving(true);

    try {
      const outCanvas = document.createElement("canvas");
      outCanvas.width = TARGET_SIZE;
      outCanvas.height = TARGET_SIZE;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) {
        setSaving(false);
        return;
      }

      const { baseScale, clampedX, clampedY } = getTransform();
      const factor = TARGET_SIZE / VIEW_SIZE;
      const finalScale = baseScale * zoom * factor;
      const targetRadius = (CORNER_RADIUS / VIEW_SIZE) * TARGET_SIZE;

      outCtx.save();
      drawRoundedRect(outCtx, 0, 0, TARGET_SIZE, TARGET_SIZE, targetRadius);
      outCtx.clip();

      // Ambient blurred background
      outCtx.save();
      outCtx.filter = "blur(16px) brightness(0.65)";
      const bgScale =
        Math.max(
          TARGET_SIZE / imageObj.naturalWidth,
          TARGET_SIZE / imageObj.naturalHeight
        ) * 1.35;
      outCtx.translate(TARGET_SIZE / 2, TARGET_SIZE / 2);
      outCtx.scale(bgScale, bgScale);
      outCtx.drawImage(
        imageObj,
        -imageObj.naturalWidth / 2,
        -imageObj.naturalHeight / 2
      );
      outCtx.restore();

      // Main image
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";
      outCtx.translate(
        TARGET_SIZE / 2 + clampedX * factor,
        TARGET_SIZE / 2 + clampedY * factor
      );
      outCtx.scale(finalScale, finalScale);
      outCtx.drawImage(
        imageObj,
        -imageObj.naturalWidth / 2,
        -imageObj.naturalHeight / 2
      );
      outCtx.restore();

      const croppedDataUrl = outCanvas.toDataURL("image/webp", 0.92);
      onCrop(croppedDataUrl);
    } catch (err) {
      console.error("Failed to crop photo:", err);
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "linear-gradient(180deg, #101626 0%, #0c101c 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "24px",
          boxShadow: "0 28px 70px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(34, 211, 238, 0.15)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={15} color="#22d3ee" />
              <h3
                style={{
                  margin: 0,
                  color: "#f8fafc",
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "-0.2px",
                }}
              >
                Profile Photo Studio
              </h3>
            </div>
            <p
              style={{
                margin: "3px 0 0",
                color: "#94a3b8",
                fontSize: "12px",
              }}
            >
              Drag to position · 1-tap smart framing
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title="Close"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 1-Tap Framing Presets */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "14px 20px 8px",
          }}
        >
          <button
            type="button"
            onClick={() => applyPreset("bust")}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: "10px",
              border:
                activePreset === "bust"
                  ? "1px solid #22d3ee"
                  : "1px solid rgba(255, 255, 255, 0.08)",
              background:
                activePreset === "bust"
                  ? "rgba(34, 211, 238, 0.14)"
                  : "rgba(255, 255, 255, 0.04)",
              color: activePreset === "bust" ? "#22d3ee" : "#cbd5e1",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>🧍 Upper Body</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("face")}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: "10px",
              border:
                activePreset === "face"
                  ? "1px solid #22d3ee"
                  : "1px solid rgba(255, 255, 255, 0.08)",
              background:
                activePreset === "face"
                  ? "rgba(34, 211, 238, 0.14)"
                  : "rgba(255, 255, 255, 0.04)",
              color: activePreset === "face" ? "#22d3ee" : "#cbd5e1",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>👤 Headshot</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("fit")}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: "10px",
              border:
                activePreset === "fit"
                  ? "1px solid #22d3ee"
                  : "1px solid rgba(255, 255, 255, 0.08)",
              background:
                activePreset === "fit"
                  ? "rgba(34, 211, 238, 0.14)"
                  : "rgba(255, 255, 255, 0.04)",
              color: activePreset === "fit" ? "#22d3ee" : "#cbd5e1",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>🖼 Fit All</span>
          </button>
        </div>

        {/* Main Squircle Workspace */}
        <div
          style={{
            padding: "10px 0 14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: `${VIEW_SIZE}px`,
              height: `${VIEW_SIZE}px`,
              borderRadius: `${CORNER_RADIUS}px`,
              overflow: "hidden",
              position: "relative",
              boxShadow:
                "0 0 0 2px rgba(34, 211, 238, 0.5), 0 18px 40px rgba(0, 0, 0, 0.75)",
              cursor: isDragging ? "grabbing" : "grab",
              background: "#070a12",
              transition: "box-shadow 0.2s ease",
            }}
          >
            <canvas
              ref={canvasRef}
              width={VIEW_SIZE}
              height={VIEW_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                touchAction: "none",
                userSelect: "none",
              }}
            />
          </div>
        </div>

        {/* Sleek Zoom Slider */}
        <div
          style={{
            padding: "0 28px 12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.1).toFixed(2)))}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>

          <input
            type="range"
            min="0.85"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => {
              setZoom(parseFloat(e.target.value));
              setActivePreset("bust"); // Custom
            }}
            style={{
              flex: 1,
              accentColor: "#22d3ee",
              cursor: "pointer",
              height: "4px",
            }}
          />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Live Mini-Previews Row */}
        <div
          style={{
            margin: "0 20px 14px",
            padding: "10px 16px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
          }}
        >
          {/* Profile Card Mini Preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(34, 211, 238, 0.4)",
                background: "#070a12",
              }}
            >
              <canvas
                ref={profileMiniCanvasRef}
                width={56}
                height={56}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#cbd5e1",
                  letterSpacing: "0.2px",
                }}
              >
                Profile Card
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#64748b" }}>
                Large Avatar
              </p>
            </div>
          </div>

          <div
            style={{
              width: "1px",
              height: "36px",
              background: "rgba(255, 255, 255, 0.08)",
            }}
          />

          {/* Top Navbar Mini Preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "9px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.35)",
                background: "#070a12",
              }}
            >
              <canvas
                ref={navbarMiniCanvasRef}
                width={30}
                height={30}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#cbd5e1",
                  letterSpacing: "0.2px",
                }}
              >
                Top Navbar
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#64748b" }}>
                Pill Badge
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "14px 20px",
            background: "rgba(255, 255, 255, 0.02)",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "9px 18px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "transparent",
              color: "#94a3b8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 22px",
              borderRadius: "12px",
              border: "none",
              background:
                "linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              boxShadow: "0 4px 16px rgba(6, 182, 212, 0.4)",
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Check size={16} />
            <span>{saving ? "Saving..." : "Save Photo"}</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
