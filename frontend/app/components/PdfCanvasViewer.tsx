"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  FileText,
  AlertCircle,
  Maximize2,
  RefreshCw,
} from "lucide-react";

interface PdfCanvasViewerProps {
  url: string;
  filename: string;
  highlightPhrase?: string;
  targetPage?: number | null;
  onFallbackToText?: () => void;
}

export default function PdfCanvasViewer({
  url,
  filename,
  highlightPhrase = "",
  targetPage = null,
  onFallbackToText,
}: PdfCanvasViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(targetPage || 1);
  const [zoom, setZoom] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageRendering, setPageRendering] = useState<boolean>(false);
  const [fitWidth, setFitWidth] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Dynamically load PDF.js script if not present
  const loadPdfJs = useCallback((): Promise<any> => {
    if (typeof window === "undefined") return Promise.reject("SSR");
    if ((window as any).pdfjsLib) {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
      return Promise.resolve(lib);
    }

    return new Promise((resolve, reject) => {
      const existing = document.getElementById("pdfjs-script");
      if (existing) {
        const check = setInterval(() => {
          if ((window as any).pdfjsLib) {
            clearInterval(check);
            const lib = (window as any).pdfjsLib;
            lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
            resolve(lib);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(check);
          if ((window as any).pdfjsLib) {
            resolve((window as any).pdfjsLib);
          } else {
            reject(new Error("Timeout loading PDF.js"));
          }
        }, 3000);
        return;
      }

      const script = document.createElement("script");
      script.id = "pdfjs-script";
      script.src = "/pdfjs/pdf.min.js";
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
          resolve(lib);
        } else {
          reject(new Error("PDF.js library loaded but pdfjsLib missing"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load PDF.js engine"));
      document.head.appendChild(script);
    });
  }, []);

  // Fetch and initialize the PDF document
  const initPdf = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pdfjsLib = await loadPdfJs();
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(
          `Document server responded with status ${response.status}`,
        );
      }
      const arrayBuffer = await response.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      const initialPage = targetPage && targetPage <= doc.numPages ? targetPage : 1;
      setCurrentPage(initialPage);
    } catch (err: any) {
      console.warn("PDF Canvas render initialization error:", err);
      setError(
        err?.message ||
          "Could not initialize visual PDF preview. You can view extracted text or open in a new tab.",
      );
    } finally {
      setLoading(false);
    }
  }, [url, loadPdfJs, targetPage]);

  useEffect(() => {
    initPdf();
  }, [initPdf]);

  // Handle targetPage changes from outside (e.g., clicking citations in chat)
  useEffect(() => {
    if (targetPage && targetPage >= 1 && targetPage <= numPages) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  // Render the current page on canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      // Cancel any ongoing render task
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (_) {}
      }

      setPageRendering(true);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Base unscaled viewport
        const baseViewport = page.getViewport({ scale: 1.0 });

        let scale = zoom / 100;
        if (fitWidth && containerRef.current) {
          const containerWidth = containerRef.current.clientWidth - 48; // padding
          if (containerWidth > 200) {
            scale = (containerWidth / baseViewport.width) * (zoom / 100);
          }
        }

        // Account for high-DPI screens (Retina)
        const outputScale = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: ctx,
          transform: transform || undefined,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Canvas render error:", err);
        }
      } finally {
        setPageRendering(false);
      }
    },
    [pdfDoc, zoom, fitWidth],
  );

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  // Handle window resize for fit-to-width
  useEffect(() => {
    if (!fitWidth) return;
    const handleResize = () => {
      if (pdfDoc && currentPage > 0) {
        renderPage(currentPage);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitWidth, pdfDoc, currentPage, renderPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((p) => p + 1);
  };

  const handleZoomIn = () => {
    setFitWidth(false);
    setZoom((z) => Math.min(250, z + 20));
  };

  const handleZoomOut = () => {
    setFitWidth(false);
    setZoom((z) => Math.max(50, z - 20));
  };

  const handleResetZoom = () => {
    setFitWidth(true);
    setZoom(100);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0d13] select-none">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#12141c] border-b border-white/10 text-xs text-gray-300 shrink-0">
        {/* Page navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 font-mono text-xs text-gray-200">
            <span className="font-semibold">{currentPage}</span>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">{numPages || "—"}</span>
          </div>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || loading}
            className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 font-mono text-xs rounded hover:bg-white/10 transition-colors text-cyan-400 font-medium cursor-pointer"
            title="Reset fit / zoom"
          >
            {fitWidth ? "Fit" : `${zoom}%`}
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer ml-1"
            title="Fit to width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Canvas Viewport ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-6 bg-[#0b0d13]"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 space-y-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <p className="text-sm font-medium text-gray-300">
              Loading high-fidelity PDF pages…
            </p>
            <p className="text-xs text-gray-500">
              Direct canvas rendering active (no browser plugin required)
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center max-w-md p-6 bg-[#161922] border border-amber-500/20 rounded-xl text-center space-y-4 my-auto">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-full">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                Visual Canvas Preview Notice
              </h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {error}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {onFallbackToText && (
                <button
                  type="button"
                  onClick={onFallbackToText}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View Parsed Document Text
                </button>
              )}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Full Tab
              </a>
              <button
                type="button"
                onClick={initPdf}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center shadow-2xl rounded-sm overflow-hidden border border-white/10 bg-white">
            {pageRendering && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10">
                <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} className="block max-w-none" />
          </div>
        )}
      </div>
    </div>
  );
}
