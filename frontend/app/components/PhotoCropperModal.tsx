"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Move,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface PhotoCropperModalProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const CANVAS_SIZE = 300;
const CROP_DIAMETER = 220;

export default function PhotoCropperModal({
  imageSrc,
  onCrop,
  onCancel,
}: PhotoCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);

  // Load the image object from the data URL
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageObj(img);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Live render on canvas whenever zoom, pan, rotation, or dragging state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Dark backdrop
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Calculate base scale to cover the crop circle
    const isSideways = rotation % 180 !== 0;
    const effW = isSideways ? imageObj.height : imageObj.width;
    const effH = isSideways ? imageObj.width : imageObj.height;
    const baseScale = Math.max(CROP_DIAMETER / effW, CROP_DIAMETER / effH);
    const totalScale = baseScale * zoom;

    // Draw transformed image
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(CANVAS_SIZE / 2 + pan.x, CANVAS_SIZE / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(totalScale, totalScale);
    ctx.drawImage(imageObj, -imageObj.width / 2, -imageObj.height / 2);
    ctx.restore();

    // Darkened vignette overlay with circular viewport cut out
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const r = CROP_DIAMETER / 2;
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(7, 10, 18, 0.72)";
    ctx.fill();

    // Glowing cyan/teal crop border
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Rule-of-thirds grid guides during dragging or adjusting
    if (isDragging) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
      ctx.clip();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const step = CROP_DIAMETER / 3;
      const startX = cx - r;
      const startY = cy - r;

      ctx.beginPath();
      ctx.moveTo(startX + step, startY);
      ctx.lineTo(startX + step, startY + CROP_DIAMETER);
      ctx.moveTo(startX + step * 2, startY);
      ctx.lineTo(startX + step * 2, startY + CROP_DIAMETER);
      ctx.moveTo(startX, startY + step);
      ctx.lineTo(startX + CROP_DIAMETER, startY + step);
      ctx.moveTo(startX, startY + step * 2);
      ctx.lineTo(startX + CROP_DIAMETER, startY + step * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [imageObj, pan, zoom, rotation, isDragging]);

  // Pointer drag events for smooth pan
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

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setZoom((prev) => Math.min(3.5, Math.max(1, +(prev + delta).toFixed(2))));
  };

  // Rotate 90° clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Reset zoom, pan, rotation
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  // Generate crisp 256x256 WebP thumbnail matching preview crop
  const handleApply = () => {
    if (!imageObj) return;
    setApplying(true);

    try {
      const outCanvas = document.createElement("canvas");
      const TARGET_SIZE = 256;
      outCanvas.width = TARGET_SIZE;
      outCanvas.height = TARGET_SIZE;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) {
        setApplying(false);
        return;
      }

      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";

      const isSideways = rotation % 180 !== 0;
      const effW = isSideways ? imageObj.height : imageObj.width;
      const effH = isSideways ? imageObj.width : imageObj.height;
      const baseScale = Math.max(CROP_DIAMETER / effW, CROP_DIAMETER / effH);
      const totalScale = baseScale * zoom;
      const factor = TARGET_SIZE / CROP_DIAMETER;

      outCtx.save();
      outCtx.translate(
        TARGET_SIZE / 2 + pan.x * factor,
        TARGET_SIZE / 2 + pan.y * factor,
      );
      outCtx.rotate((rotation * Math.PI) / 180);
      outCtx.scale(totalScale * factor, totalScale * factor);
      outCtx.drawImage(imageObj, -imageObj.width / 2, -imageObj.height / 2);
      outCtx.restore();

      const croppedDataUrl = outCanvas.toDataURL("image/webp", 0.88);
      onCrop(croppedDataUrl);
    } catch (err) {
      console.error("Error cropping image:", err);
      setApplying(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "cropperFadeIn 0.2s ease-out forwards",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#0d111c",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: "var(--text-primary, #f1f5f9)",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              Adjust Profile Photo
            </h3>
            <p
              style={{
                margin: "3px 0 0",
                color: "var(--text-muted, #94a3b8)",
                fontSize: "12px",
              }}
            >
              Drag to position · Zoom to frame
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title="Cancel"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "var(--text-secondary, #94a3b8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Canvas Workspace */}
        <div
          style={{
            padding: "20px 20px 10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background:
              "radial-gradient(circle at center, rgba(34, 211, 238, 0.04) 0%, transparent 70%)",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              userSelect: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              marginTop: "8px",
              fontSize: "11px",
              color: "#64748b",
            }}
          >
            <Move size={12} />
            <span>Click & drag to reposition · Scroll or slide to zoom</span>
          </div>
        </div>

        {/* Controls Section */}
        <div
          style={{
            padding: "12px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Zoom Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
              title="Zoom Out"
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ZoomOut size={16} />
            </button>

            <input
              type="range"
              min="1"
              max="3.5"
              step="0.02"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: "var(--accent-primary, #22d3ee)",
                cursor: "pointer",
              }}
            />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.1).toFixed(2)))}
              title="Zoom In"
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ZoomIn size={16} />
            </button>

            <span
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                minWidth: "35px",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Quick Tool Pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={handleRotate}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary, #cbd5e1)",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
              }}
            >
              <RotateCw size={13} />
              <span>Rotate 90°</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary, #cbd5e1)",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              padding: "7px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-secondary, #cbd5e1)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            style={{
              background:
                "linear-gradient(135deg, var(--accent-primary, #22d3ee), #0891b2)",
              border: "none",
              borderRadius: "10px",
              padding: "7px 20px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#0a0e17",
              cursor: applying ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 14px rgba(34, 211, 238, 0.35)",
            }}
          >
            <Check size={14} />
            <span>{applying ? "Applying…" : "Apply & Save"}</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes cropperFadeIn {
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
