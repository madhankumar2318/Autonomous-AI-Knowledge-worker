"use client";
import { Brain, LogOut } from "lucide-react";
import { useState } from "react";
import FileUpload from "./components/FileUpload";
import HistorySection from "./components/HistorySection";
import LoginForm from "./components/LoginForm";
import NewsSection from "./components/NewsSection";
import ReportSection from "./components/ReportSection";
import SearchSection from "./components/SearchSection";
import StockSection from "./components/StockSection";
import { ToastContainer } from "./components/Toast";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 🔐 Login Protection
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background glow effects on login screen */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          <LoginForm onLoginSuccess={() => setIsLoggedIn(true)} />
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer />

      {/* Header */}
      <header
        style={{
          background: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
        className="sticky top-0 z-50"
      >
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                  Autonomous AI Knowledge Worker
                </h1>
                <p className="text-xs leading-tight" style={{ color: "var(--text-muted)" }}>
                  AI-powered insights &amp; research
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HistorySection compact={true} limit={5} />
              <button
                type="button"
                onClick={() => setIsLoggedIn(false)}
                className="btn btn-ghost flex items-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-6 py-6 relative">
        {/* Glow Effects */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/15 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/15 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Two-column grid — left takes 2/3, right takes 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[calc(100vh-120px)]">

          {/* Left Column — News (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <div className="card flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-3 mb-5 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-lg">📰</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Latest News
                </h2>
              </div>
              {/* Independent scrolling news */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                <NewsSection infiniteScroll={true} />
              </div>
            </div>
          </div>

          {/* Right Column — CSS Grid rows, equal 4-way split */}
          <div
            className="lg:col-span-1 card-sm"
            style={{
              height: "calc(100vh - 120px)",
              display: "grid",
              gridTemplateRows: "1fr 1fr 1fr 1fr",
              overflow: "hidden",
            }}
          >

            {/* Row 1 — Search */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: "12px", minHeight: 0 }}>
              <div className="flex items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-sm">🔍</span>
                </div>
                <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Search
                </h2>
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                <SearchSection infiniteScroll={true} />
              </div>
            </div>

            {/* Row 2 — Stock Market */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.07)", minHeight: 0 }}>
              <div className="flex items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-sm">📈</span>
                </div>
                <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Stock Market
                </h2>
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                <StockSection />
              </div>
            </div>

            {/* Row 3 — Reports */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.07)", minHeight: 0 }}>
              <div className="flex items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-sm">📊</span>
                </div>
                <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Reports
                </h2>
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                <ReportSection />
              </div>
            </div>

            {/* Row 4 — File Upload */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.07)", minHeight: 0 }}>
              <div className="flex items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-sm">📁</span>
                </div>
                <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  File Upload
                </h2>
              </div>
              <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                <FileUpload />
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(10,10,10,0.6)" }}>
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              © {new Date().getFullYear()} Autonomous AI Knowledge Worker
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              AI-powered · Real-time insights
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
