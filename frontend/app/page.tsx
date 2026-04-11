"use client";
import { Brain, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import FileUpload from "./components/FileUpload";
import HistorySection from "./components/HistorySection";
import LoginForm from "./components/LoginForm";
import NewsSection from "./components/NewsSection";
import ReportHeaderButton from "./components/ReportHeaderButton";
import ChatAssistant from "./components/ChatAssistant";
import SearchSection from "./components/SearchSection";
import StockSection from "./components/StockSection";
import { ToastContainer } from "./components/Toast";
import UserProfile from "./components/UserProfile";
import ThemeToggle from "./components/ThemeToggle";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [showProfile, setShowProfile]   = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // ── Restore persisted session on every page load ──────────────────
  useEffect(() => {
    // Restore saved theme immediately
    const savedTheme = localStorage.getItem("ak_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Then restore session
    const saved = localStorage.getItem("ak_session");
    if (!saved) { setSessionChecked(true); return; }

    fetch(`http://127.0.0.1:8000/auth/verify?username=${encodeURIComponent(saved)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setLoggedInUser(data.username);
        setIsLoggedIn(true);
      })
      .catch(() => localStorage.removeItem("ak_session")) // expired / deleted user
      .finally(() => setSessionChecked(true));
  }, []);

  // ── Show a blank loading splash while we check ────────────────────
  if (!sessionChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "#070d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "16px", background: "linear-gradient(135deg, #2563eb, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(37,99,235,0.4)" }}>
          <Brain size={26} style={{ color: "white" }} />
        </div>
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "3px solid rgba(37,99,235,0.2)", borderTopColor: "#2563eb", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#334155", fontSize: "13px", fontWeight: 600, letterSpacing: "1px" }}>Checking session…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#020817]">
        {/* Electric Ocean Fluid Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none filter blur-[110px] saturate-[1.8]">
          {/* Royal Blue — top-left anchor */}
          <div className="absolute top-[-15%] left-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen bg-[#1d4ed8] animate-liquid-1 opacity-75"></div>
          {/* Electric Cobalt — center-right sweep */}
          <div className="absolute top-[10%] right-[-15%] w-[60vw] h-[60vw] rounded-full mix-blend-screen bg-[#3b82f6] animate-liquid-2 opacity-50"></div>
          {/* Teal — bottom-left */}
          <div className="absolute bottom-[-25%] left-[10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen bg-[#0d9488] animate-liquid-3 opacity-45"></div>
          {/* Indigo-Blue — bottom-right balance */}
          <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full mix-blend-screen bg-[#1e40af] animate-liquid-1 opacity-40" style={{ animationDelay: "14s" }}></div>
        </div>

        {/* Center focus vignette — draws eyes to the login card */}
        <div className="absolute inset-0 z-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 70% at 50% 50%, transparent 30%, rgba(2, 8, 23, 0.65) 100%)" }}>
        </div>

        {/* SVG Noise Matte Texture Overlay */}
        <div className="absolute inset-0 z-0 opacity-[0.18] mix-blend-overlay pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml;utf8,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>

        <div className="w-full relative z-10 flex justify-center">
          <LoginForm onLoginSuccess={(username) => {
            setIsLoggedIn(true);
            setLoggedInUser(username);
            localStorage.setItem("ak_session", username); // 💾 Persist
          }} />
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
          background: "rgba(10, 10, 10, 0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
        className="sticky top-0 z-50"
      >
        <div className="w-full py-3" style={{ paddingLeft: "24px", paddingRight: "24px" }}>
          <div className="flex justify-between items-center gap-4" style={{ minWidth: 0 }}>
            {/* Brand */}
            <div className="flex items-center gap-3" style={{ minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                  Autonomous AI Knowledge Worker
                </h1>
                <p className="text-xs leading-tight" style={{ color: "var(--text-muted)" }}>
                  AI-powered insights &amp; research
                </p>
              </div>
            </div>

            {/* Right-side actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "0", flexShrink: 0 }}>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Vertical divider */}
              <div style={{ width: "1px", height: "28px", background: "linear-gradient(to bottom, transparent, rgba(128,128,128,0.3), transparent)", margin: "0 10px", flexShrink: 0 }} />

              {/* Report Button */}
              <ReportHeaderButton />

              {/* Vertical divider */}
              <div style={{
                width: "1px",
                height: "28px",
                background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.18), transparent)",
                margin: "0 12px",
                flexShrink: 0,
              }} />

              {/* Activity */}
              <HistorySection compact={true} limit={5} />

              {/* Vertical divider */}
              <div style={{
                width: "1px",
                height: "28px",
                background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.18), transparent)",
                margin: "0 12px",
                flexShrink: 0,
              }} />

              {/* User Avatar Button */}
              <button
                type="button"
                onClick={() => setShowProfile(true)}
                title={`Signed in as @${loggedInUser}`}
                className="flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-xl transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(13,148,136,0.15))",
                  border: "1px solid rgba(59,130,246,0.25)",
                  cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(13,148,136,0.22))"}
                onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(13,148,136,0.15))"}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[11px]"
                  style={{ background: "linear-gradient(135deg, #2563eb, #0d9488)" }}
                >
                  {loggedInUser.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-white text-[13px] hidden sm:block" style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {loggedInUser}
                </span>
              </button>

              {/* Vertical divider */}
              <div style={{
                width: "1px",
                height: "28px",
                background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.18), transparent)",
                margin: "0 12px",
                flexShrink: 0,
              }} />

              {/* Logout — red-accent pill */}
              <button
                type="button"
                onClick={() => { localStorage.removeItem("ak_session"); setIsLoggedIn(false); setLoggedInUser(""); }}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
                style={{
                  color: "#fca5a5",
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  backdropFilter: "blur(8px)",
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.color = "#ffffff";
                  b.style.background = "rgba(239,68,68,0.22)";
                  b.style.borderColor = "rgba(239,68,68,0.55)";
                  b.style.boxShadow = "0 0 16px rgba(239,68,68,0.3)";
                  b.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.color = "#fca5a5";
                  b.style.background = "rgba(239,68,68,0.10)";
                  b.style.borderColor = "rgba(239,68,68,0.25)";
                  b.style.boxShadow = "none";
                  b.style.transform = "translateY(0)";
                }}
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

          {/* Right Column — CSS Grid rows, proportionally split */}
          <div
            className="lg:col-span-1 card-sm"
            style={{
              height: "calc(100vh - 120px)",
              display: "grid",
              gridTemplateRows: "1fr 2.5fr 1fr",
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

      {/* Floating AI Chat Assistant — fixed bottom-right */}
      <ChatAssistant />

      {/* User Profile Slide-in Panel */}
      {showProfile && (
        <UserProfile
          username={loggedInUser}
          onClose={() => setShowProfile(false)}
          onLogout={() => { localStorage.removeItem("ak_session"); setShowProfile(false); setIsLoggedIn(false); setLoggedInUser(""); }}
        />
      )}

    </div>
  );
}
