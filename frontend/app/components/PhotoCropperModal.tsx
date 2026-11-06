"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface PhotoCropperModalProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const VIEW_SIZE = 240; // 240px circular preview
const TARGET_SIZE = 256; // 256x256 crisp avatar export

export default function PhotoCropperModal({
  imageSrc,
  onCrop,
  onCancel,
}: PhotoCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageObj(img);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Compute cover scale and generous panning range so user can freely align left/right and up/down
  const getTransform = () => {
    if (!imageObj) return { baseScale: 1, totalScale: 1, clampedX: 0, clampedY: 0 };

    const baseScale = Math.max(
      VIEW_SIZE / imageObj.naturalWidth,
      VIEW_SIZE / imageObj.naturalHeight
    );
    const totalScale = baseScale * zoom;

    const currentW = imageObj.naturalWidth * totalScale;
    const currentH = imageObj.naturalHeight * totalScale;

    // Generous panning room: allows at least 50% view travel in all directions
    const maxPanX = Math.max(VIEW_SIZE * 0.5, (currentW - VIEW_SIZE) / 2 + 30);
    const maxPanY = Math.max(VIEW_SIZE * 0.5, (currentH - VIEW_SIZE) / 2 + 30);

    const clampedX = Math.max(-maxPanX, Math.min(maxPanX, pan.x));
    const clampedY = Math.max(-maxPanY, Math.min(maxPanY, pan.y));

    return { baseScale, totalScale, clampedX, clampedY, currentW, currentH };
  };

  // Render preview canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    const { totalScale, clampedX, clampedY } = getTransform();

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(VIEW_SIZE / 2, VIEW_SIZE / 2, VIEW_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // 1. Ambient blurred background fill so moving left/right never exposes harsh voids
    ctx.save();
    ctx.filter = "blur(14px) brightness(0.65)";
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
  }, [imageObj, zoom, pan]);

  // Pointer drag events
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
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((prev) => Math.min(3, Math.max(0.8, +(prev + delta).toFixed(2))));
  };

  // Nudge alignment helpers (step 18px per click)
  const nudge = (dx: number, dy: number) => {
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const resetAlignment = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Save 256x256 crisp avatar with exact WYSIWYG crop
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

      outCtx.save();
      outCtx.beginPath();
      outCtx.arc(TARGET_SIZE / 2, TARGET_SIZE / 2, TARGET_SIZE / 2, 0, Math.PI * 2);
      outCtx.clip();

      // Ambient blurred background
      outCtx.save();
      outCtx.filter = "blur(14px) brightness(0.65)";
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

      const croppedDataUrl = outCanvas.toDataURL("image/webp", 0.9);
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
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "modalFadeIn 0.18s ease-out forwards",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "#0c101b",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.9)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: "#f8fafc",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "-0.2px",
              }}
            >
              Adjust Profile Photo
            </h3>
            <p
              style={{
                margin: "3px 0 0",
                color: "#94a3b8",
                fontSize: "12px",
              }}
            >
              Drag or use arrows to position correctly
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title="Close"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Circular Preview Container */}
        <div
          style={{
            padding: "16px 0 10px",
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
              borderRadius: "50%",
              overflow: "hidden",
              position: "relative",
              boxShadow:
                "0 0 0 3px rgba(34, 211, 238, 0.55), 0 16px 36px rgba(0, 0, 0, 0.65)",
              cursor: isDragging ? "grabbing" : "grab",
              background: "#070a12",
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

        {/* Directional Alignment & Nudge Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "6px 20px 10px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "#64748b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginRight: "4px",
            }}
          >
            Align:
          </span>

          <button
            type="button"
            onClick={() => nudge(-18, 0)}
            title="Move Left"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={14} />
          </button>

          <button
            type="button"
            onClick={() => nudge(18, 0)}
            title="Move Right"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => nudge(0, -18)}
            title="Move Up"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowUp size={14} />
          </button>

          <button
            type="button"
            onClick={() => nudge(0, 18)}
            title="Move Down"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowDown size={14} />
          </button>

          <button
            type="button"
            onClick={resetAlignment}
            title="Reset to center"
            style={{
              padding: "0 10px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#94a3b8",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={12} />
            <span>Center</span>
          </button>
        </div>

        {/* Minimal Zoom Bar */}
        <div
          style={{
            padding: "4px 24px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.15).toFixed(2)))}
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
            min="0.8"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{
              flex: 1,
              accentColor: "#22d3ee",
              cursor: "pointer",
              height: "4px",
            }}
          />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}
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

        {/* Action Buttons */}
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
              padding: "8px 16px",
              borderRadius: "10px",
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
              padding: "8px 20px",
              borderRadius: "10px",
              border: "none",
              background:
                "linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 14px rgba(6, 182, 212, 0.35)",
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Check size={15} />
            <span>{saving ? "Saving..." : "Save Photo"}</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96);
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
