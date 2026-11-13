"use client";
import React, { useEffect, useRef, useState } from "react";
import { Check, RotateCw, RotateCcw, X } from "lucide-react";

interface PhotoCropperModalProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const MAX_STAGE_W = 340;
const MAX_STAGE_H = 340;
const TARGET_SIZE = 256;
const MIN_CROP_SIZE = 50;

type DragHandle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;

export default function PhotoCropperModal({
  imageSrc,
  onCrop,
  onCancel,
}: PhotoCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement>(null);

  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);

  // Layout inside the stage
  const [stageSize, setStageSize] = useState({ w: 300, h: 300 });

  // WhatsApp Square Crop Box: { x, y, size } in stage coordinates
  const [crop, setCrop] = useState({ x: 20, y: 20, size: 200 });

  // Dragging state
  const [dragMode, setDragMode] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState({ px: 0, py: 0, cx: 0, cy: 0, cSize: 0 });
  const [saving, setSaving] = useState(false);

  // Load image
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    // Only set crossOrigin for remote URLs; setting crossOrigin on data: URLs causes errors in some browsers
    if (!imageSrc.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      setImageObj(img);
      initializeCrop(img, 0);
    };
    img.onerror = (err) => {
      console.error("Failed to load image into cropper:", err);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Compute stage size and initial centered WhatsApp crop box
  const initializeCrop = (img: HTMLImageElement, rot: number) => {
    const isSideways = rot % 180 !== 0;
    const nw = isSideways ? img.naturalHeight : img.naturalWidth;
    const nh = isSideways ? img.naturalWidth : img.naturalHeight;

    // Fit image inside MAX_STAGE_W x MAX_STAGE_H
    const scale = Math.min(MAX_STAGE_W / nw, MAX_STAGE_H / nh);
    const w = Math.round(nw * scale);
    const h = Math.round(nh * scale);

    setStageSize({ w, h });

    // Initial WhatsApp square crop: covers 85% of smaller dimension, placed near top/center
    const size = Math.round(Math.min(w, h) * 0.82);
    const x = Math.round((w - size) / 2);
    // Bias slightly toward top (where human heads are)
    const y = Math.round(Math.max(0, (h - size) * 0.18));

    setCrop({ x, y, size });
  };

  // Handle 90 deg clockwise rotate
  const handleRotate = () => {
    if (!imageObj) return;
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    initializeCrop(imageObj, newRot);
  };

  // Handle Reset to full initial crop
  const handleReset = () => {
    if (!imageObj) return;
    initializeCrop(imageObj, rotation);
  };

  // Live Canvas Rendering (Photo + WhatsApp Dimmed Overlay + Crop Box + Brackets)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = stageSize;
    ctx.clearRect(0, 0, w, h);

    // 1. Draw base photo with rotation
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const isSideways = rotation % 180 !== 0;
    const drawW = isSideways ? h : w;
    const drawH = isSideways ? w : h;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // 2. WhatsApp Dimmed Vignette Overlay outside the crop box
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";

    // Top rect
    ctx.fillRect(0, 0, w, crop.y);
    // Bottom rect
    ctx.fillRect(0, crop.y + crop.size, w, h - (crop.y + crop.size));
    // Left rect
    ctx.fillRect(0, crop.y, crop.x, crop.size);
    // Right rect
    ctx.fillRect(crop.x + crop.size, crop.y, w - (crop.x + crop.size), crop.size);
    ctx.restore();

    // 3. Crisp Crop Box Border
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(crop.x, crop.y, crop.size, crop.size);

    // 4. Subtle 3x3 Rule-of-Thirds Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 0.8;
    const step = crop.size / 3;

    ctx.beginPath();
    // Vertical grid lines
    ctx.moveTo(crop.x + step, crop.y);
    ctx.lineTo(crop.x + step, crop.y + crop.size);
    ctx.moveTo(crop.x + step * 2, crop.y);
    ctx.lineTo(crop.x + step * 2, crop.y + crop.size);
    // Horizontal grid lines
    ctx.moveTo(crop.x, crop.y + step);
    ctx.lineTo(crop.x + crop.size, crop.y + step);
    ctx.moveTo(crop.x, crop.y + step * 2);
    ctx.lineTo(crop.x + crop.size, crop.y + step * 2);
    ctx.stroke();

    // 5. WhatsApp Iconic Corner L-Brackets (Thick white corners)
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "square";
    const arm = Math.min(20, crop.size * 0.2);

    ctx.beginPath();
    // Top-Left
    ctx.moveTo(crop.x, crop.y + arm);
    ctx.lineTo(crop.x, crop.y);
    ctx.lineTo(crop.x + arm, crop.y);

    // Top-Right
    ctx.moveTo(crop.x + crop.size - arm, crop.y);
    ctx.lineTo(crop.x + crop.size, crop.y);
    ctx.lineTo(crop.x + crop.size, crop.y + arm);

    // Bottom-Right
    ctx.moveTo(crop.x + crop.size, crop.y + crop.size - arm);
    ctx.lineTo(crop.x + crop.size, crop.y + crop.size);
    ctx.lineTo(crop.x + crop.size - arm, crop.y + crop.size);

    // Bottom-Left
    ctx.moveTo(crop.x + arm, crop.y + crop.size);
    ctx.lineTo(crop.x, crop.y + crop.size);
    ctx.lineTo(crop.x, crop.y + crop.size - arm);
    ctx.stroke();

    // Edge midpoint grips
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 3;
    const midArm = 10;
    ctx.beginPath();
    // Top edge
    ctx.moveTo(crop.x + crop.size / 2 - midArm, crop.y);
    ctx.lineTo(crop.x + crop.size / 2 + midArm, crop.y);
    // Bottom edge
    ctx.moveTo(crop.x + crop.size / 2 - midArm, crop.y + crop.size);
    ctx.lineTo(crop.x + crop.size / 2 + midArm, crop.y + crop.size);
    // Left edge
    ctx.moveTo(crop.x, crop.y + crop.size / 2 - midArm);
    ctx.lineTo(crop.x, crop.y + crop.size / 2 + midArm);
    // Right edge
    ctx.moveTo(crop.x + crop.size, crop.y + crop.size / 2 - midArm);
    ctx.lineTo(crop.x + crop.size, crop.y + crop.size / 2 + midArm);
    ctx.stroke();

    ctx.restore();

    // 6. Synchronize Live Mini-Preview
    if (miniCanvasRef.current) {
      const mCtx = miniCanvasRef.current.getContext("2d");
      if (mCtx) {
        mCtx.clearRect(0, 0, 56, 56);
        // Draw the exact square crop region into the 56x56 mini preview
        mCtx.drawImage(
          canvas,
          crop.x,
          crop.y,
          crop.size,
          crop.size,
          0,
          0,
          56,
          56
        );
      }
    }
  }, [imageObj, stageSize, crop, rotation]);

  // Determine which handle is under the pointer
  const getHandleAt = (px: number, py: number): DragHandle => {
    const hitRadius = 24;
    const { x, y, size } = crop;

    // Corners (checked first for precision)
    if (Math.hypot(px - x, py - y) <= hitRadius) return "nw";
    if (Math.hypot(px - (x + size), py - y) <= hitRadius) return "ne";
    if (Math.hypot(px - x, py - (y + size)) <= hitRadius) return "sw";
    if (Math.hypot(px - (x + size), py - (y + size)) <= hitRadius) return "se";

    // Edges
    if (Math.abs(py - y) <= 12 && px >= x && px <= x + size) return "n";
    if (Math.abs(py - (y + size)) <= 12 && px >= x && px <= x + size) return "s";
    if (Math.abs(px - x) <= 12 && py >= y && py <= y + size) return "w";
    if (Math.abs(px - (x + size)) <= 12 && py >= y && py <= y + size) return "e";

    // Inside crop box -> move
    if (px >= x && px <= x + size && py >= y && py <= y + size) return "move";

    return null;
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const handle = getHandleAt(px, py);
    if (!handle) return;

    setDragMode(handle);
    setDragStart({
      px,
      py,
      cx: crop.x,
      cy: crop.y,
      cSize: crop.size,
    });

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  // Pointer Move (Smooth square resize & translation)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (!dragMode) {
      // Dynamic cursor update on hover
      const hoverHandle = getHandleAt(px, py);
      if (hoverHandle === "nw" || hoverHandle === "se") {
        canvas.style.cursor = "nwse-resize";
      } else if (hoverHandle === "ne" || hoverHandle === "sw") {
        canvas.style.cursor = "nesw-resize";
      } else if (hoverHandle === "n" || hoverHandle === "s") {
        canvas.style.cursor = "ns-resize";
      } else if (hoverHandle === "e" || hoverHandle === "w") {
        canvas.style.cursor = "ew-resize";
      } else if (hoverHandle === "move") {
        canvas.style.cursor = "move";
      } else {
        canvas.style.cursor = "default";
      }
      return;
    }

    const dx = px - dragStart.px;
    const dy = py - dragStart.py;
    const { w, h } = stageSize;
    const { cx, cy, cSize } = dragStart;

    if (dragMode === "move") {
      // Move box around clamped to stage bounds
      const nextX = Math.max(0, Math.min(w - cSize, cx + dx));
      const nextY = Math.max(0, Math.min(h - cSize, cy + dy));
      setCrop({ x: Math.round(nextX), y: Math.round(nextY), size: cSize });
    } else if (dragMode === "se" || dragMode === "e" || dragMode === "s") {
      // Expand / shrink from bottom-right corner
      const delta = Math.max(dx, dy);
      const maxAvailable = Math.min(w - cx, h - cy);
      const nextSize = Math.max(MIN_CROP_SIZE, Math.min(maxAvailable, cSize + delta));
      setCrop({ x: cx, y: cy, size: Math.round(nextSize) });
    } else if (dragMode === "nw" || dragMode === "w" || dragMode === "n") {
      // Expand / shrink from top-left corner
      const delta = Math.max(-dx, -dy);
      const maxAvailable = Math.min(cx + cSize, cy + cSize);
      const nextSize = Math.max(MIN_CROP_SIZE, Math.min(maxAvailable, cSize + delta));
      const nextX = cx + cSize - nextSize;
      const nextY = cy + cSize - nextSize;
      setCrop({ x: Math.round(nextX), y: Math.round(nextY), size: Math.round(nextSize) });
    } else if (dragMode === "ne") {
      // Expand / shrink from top-right corner
      const delta = Math.max(dx, -dy);
      const maxAvailable = Math.min(w - cx, cy + cSize);
      const nextSize = Math.max(MIN_CROP_SIZE, Math.min(maxAvailable, cSize + delta));
      const nextY = cy + cSize - nextSize;
      setCrop({ x: cx, y: Math.round(nextY), size: Math.round(nextSize) });
    } else if (dragMode === "sw") {
      // Expand / shrink from bottom-left corner
      const delta = Math.max(-dx, dy);
      const maxAvailable = Math.min(cx + cSize, h - cy);
      const nextSize = Math.max(MIN_CROP_SIZE, Math.min(maxAvailable, cSize + delta));
      const nextX = cx + cSize - nextSize;
      setCrop({ x: Math.round(nextX), y: cy, size: Math.round(nextSize) });
    }
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setDragMode(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Save the cropped image at crisp 256x256 resolution
  const handleSave = () => {
    if (!imageObj) return;
    setSaving(true);

    try {
      // Render full rotated image to an offscreen buffer at high resolution
      const isSideways = rotation % 180 !== 0;
      const nw = isSideways ? imageObj.naturalHeight : imageObj.naturalWidth;
      const nh = isSideways ? imageObj.naturalWidth : imageObj.naturalHeight;

      const buffer = document.createElement("canvas");
      buffer.width = nw;
      buffer.height = nh;
      const bCtx = buffer.getContext("2d");
      if (!bCtx) {
        setSaving(false);
        return;
      }

      bCtx.translate(nw / 2, nh / 2);
      bCtx.rotate((rotation * Math.PI) / 180);
      bCtx.imageSmoothingEnabled = true;
      bCtx.imageSmoothingQuality = "high";
      bCtx.drawImage(
        imageObj,
        -imageObj.naturalWidth / 2,
        -imageObj.naturalHeight / 2
      );

      // Map stage crop coordinates to original full-resolution image coordinates
      const scaleToNatural = nw / stageSize.w;
      const sx = Math.round(crop.x * scaleToNatural);
      const sy = Math.round(crop.y * scaleToNatural);
      const sSize = Math.round(crop.size * scaleToNatural);

      // Output canvas (256x256)
      const outCanvas = document.createElement("canvas");
      outCanvas.width = TARGET_SIZE;
      outCanvas.height = TARGET_SIZE;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) {
        setSaving(false);
        return;
      }

      // Draw rounded squircle clipping path
      const r = 32;
      outCtx.beginPath();
      if (typeof outCtx.roundRect === "function") {
        outCtx.roundRect(0, 0, TARGET_SIZE, TARGET_SIZE, r);
      } else {
        outCtx.moveTo(r, 0);
        outCtx.lineTo(TARGET_SIZE - r, 0);
        outCtx.quadraticCurveTo(TARGET_SIZE, 0, TARGET_SIZE, r);
        outCtx.lineTo(TARGET_SIZE, TARGET_SIZE - r);
        outCtx.quadraticCurveTo(TARGET_SIZE, TARGET_SIZE, TARGET_SIZE - r, TARGET_SIZE);
        outCtx.lineTo(r, TARGET_SIZE);
        outCtx.quadraticCurveTo(0, TARGET_SIZE, 0, TARGET_SIZE - r);
        outCtx.lineTo(0, r);
        outCtx.quadraticCurveTo(0, 0, r, 0);
      }
      outCtx.clip();

      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";
      outCtx.drawImage(buffer, sx, sy, sSize, sSize, 0, 0, TARGET_SIZE, TARGET_SIZE);

      const croppedDataUrl = outCanvas.toDataURL("image/webp", 0.92);
      onCrop(croppedDataUrl);
    } catch (err) {
      console.error("Error cropping image:", err);
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "rgba(0, 0, 0, 0.85)",
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
          maxWidth: "400px",
          background: "#0c101a",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "24px",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.95)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
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
              Crop Profile Photo
            </h3>
            <p
              style={{
                margin: "3px 0 0",
                color: "#94a3b8",
                fontSize: "12px",
              }}
            >
              Drag corners to resize · Drag box to position
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
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* WhatsApp Interactive Cropping Canvas Stage */}
        <div
          style={{
            padding: "20px 16px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#07090e",
            minHeight: "340px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: `${stageSize.w}px`,
              height: `${stageSize.h}px`,
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8)",
              borderRadius: "4px",
              overflow: "hidden",
              userSelect: "none",
            }}
          >
            <canvas
              ref={canvasRef}
              width={stageSize.w}
              height={stageSize.h}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                touchAction: "none",
              }}
            />
          </div>
        </div>

        {/* Quick Toolbar (Rotate + Reset + Mini Avatar Preview) */}
        <div
          style={{
            padding: "10px 20px",
            background: "rgba(255, 255, 255, 0.02)",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Rotate & Reset Controls */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleRotate}
              title="Rotate 90° Clockwise"
              style={{
                padding: "6px 12px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
              }}
            >
              <RotateCw size={13} />
              <span>Rotate</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              title="Reset Crop Box"
              style={{
                padding: "6px 12px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: 600,
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

          {/* Mini Live Result Preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
              Preview:
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                overflow: "hidden",
                boxShadow:
                  "0 2px 10px rgba(0, 0, 0, 0.5), 0 0 0 1.5px rgba(34, 211, 238, 0.6)",
                background: "#000",
              }}
            >
              <canvas
                ref={miniCanvasRef}
                width={56}
                height={56}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
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

      <style>{`
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
