"use client";
import {
  Brain,
  FolderOpen,
  LogOut,
  MessageSquare,
  Newspaper,
  Search,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import ChatAssistant from "./components/ChatAssistant";
import FileUpload from "./components/FileUpload";
import HistorySection from "./components/HistorySection";
import LoginForm from "./components/LoginForm";
import NewsSection from "./components/NewsSection";
import ReportHeaderButton from "./components/ReportHeaderButton";
import SearchSection from "./components/SearchSection";
import StockSection from "./components/StockSection";
import ThemeToggle from "./components/ThemeToggle";
import { ToastContainer } from "./components/Toast";
import UserProfile from "./components/UserProfile";

export default function Home_Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Layout navigation state
  const [activeTab, setActiveTab] = useState("news");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchTrigger, setGlobalSearchTrigger] = useState("");

  // Restore persisted session on page load
  useEffect(() => {
    const savedTheme = localStorage.getItem("ak_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    const saved = localStorage.getItem("ak_session");
    if (!saved) {
      setSessionChecked(true);
      return;
    }

    fetch(
      `http://127.0.0.1:8000/auth/verify?username=${encodeURIComponent(saved)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setLoggedInUser(data.username);
        setIsLoggedIn(true);
      })
      .catch(() => localStorage.removeItem("ak_session"))
      .finally(() => setSessionChecked(true));
  }, []);

  const handleGlobalSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (globalSearchQuery.trim()) {
      setGlobalSearchTrigger(globalSearchQuery.trim());
      setActiveTab("search");
    }
  };

  // Loading Splash
  if (!sessionChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#070d1a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #2563eb, #0d9488)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(37,99,235,0.4)",
          }}
        >
          <Brain size={26} style={{ color: "white" }} />
        </div>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "3px solid rgba(37,99,235,0.2)",
            borderTopColor: "#2563eb",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p
          style={{
            color: "#334155",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "1px",
          }}
        >
          Checking session…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not Logged In -> Login view
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#020817]">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none filter blur-[110px] saturate-[1.8]">
          <div className="absolute top-[-15%] left-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen bg-[#1d4ed8] opacity-75"></div>
          <div className="absolute top-[10%] right-[-15%] w-[60vw] h-[60vw] rounded-full mix-blend-screen bg-[#3b82f6] opacity-50"></div>
          <div className="absolute bottom-[-25%] left-[10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen bg-[#0d9488] opacity-45"></div>
        </div>
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 50% 50%, transparent 30%, rgba(2, 8, 23, 0.65) 100%)",
          }}
        />
        <div className="w-full relative z-10 flex justify-center">
          <LoginForm
            onLoginSuccess={(username) => {
              setIsLoggedIn(true);
              setLoggedInUser(username);
              localStorage.setItem("ak_session", username);
            }}
          />
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-[#050508]"
      style={{ color: "var(--text-primary)" }}
    >
      <ToastContainer />

      {/* ── HEADER ── */}
      <header
        style={{
          background: "rgba(10, 10, 10, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        className="sticky top-0 z-50 w-full flex justify-center"
      >
        <div className="w-full max-w-[1600px] py-3.5 px-6 flex items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold leading-tight">
                AI Workspace
              </h1>
              <p className="text-[10px] leading-tight text-white/40">
                Autonomous Knowledge Worker
              </p>
            </div>
          </div>

          {/* Center: Global Search Bar */}
          <form
            onSubmit={handleGlobalSearch}
            className="flex-1 max-w-xl relative mx-auto hidden md:block"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-none" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search news topics, stocks or workspace files..."
              className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:bg-white/10 focus:border-purple-500/50 transition-all"
            />
          </form>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <ThemeToggle />
            <div className="w-[1px] height-[24px] bg-white/10 mx-1 hidden sm:block" />
            <ReportHeaderButton />
            <HistorySection compact={true} limit={5} />
            <div className="w-[1px] height-[24px] bg-white/10 mx-1 hidden sm:block" />

            {/* Profile */}
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center text-white text-[10px] font-black">
                {loggedInUser.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold hidden lg:block">
                {loggedInUser}
              </span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("ak_session");
                setIsLoggedIn(false);
                setLoggedInUser("");
              }}
              className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-white transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── SUB-HEADER NAVIGATION TABS ── */}
        <div className="w-full border-t border-white/5 bg-black/30 flex justify-center">
          <div className="w-full max-w-[1600px] px-6 flex items-center gap-6 overflow-x-auto scrollbar-none">
            {[
              {
                id: "news",
                label: "Live News",
                icon: <Newspaper className="w-4 h-4" />,
              },
              {
                id: "stocks",
                label: "Stock Market",
                icon: <TrendingUp className="w-4 h-4" />,
              },
              {
                id: "chat",
                label: "AI Chat Agent",
                icon: <MessageSquare className="w-4 h-4" />,
              },
              {
                id: "files",
                label: "File Workspace",
                icon: <FolderOpen className="w-4 h-4" />,
              },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-1 relative font-medium text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer`}
                  style={{
                    color: isActive
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT VIEWPORTS ── */}
      <main className="flex-1 w-full max-w-[1600px] self-center px-6 py-6 relative">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* 📰 NEWS FEED TAB */}
        {activeTab === "news" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-purple-400" /> Live News Desk
            </h2>
            <NewsSection infiniteScroll={true} />
          </div>
        )}

        {/* 📈 STOCKS TAB */}
        {activeTab === "stocks" && (
          <div className="space-y-4 bg-white/4 border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" /> Stock Market
              Watchlist
            </h2>
            <StockSection compact={false} />
          </div>
        )}

        {/* 💬 CHAT TAB */}
        {activeTab === "chat" && (
          <div className="bg-white/4 border border-white/5 rounded-2xl p-6 min-h-[500px] flex flex-col">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" /> AI Agent
              Workspace
            </h2>
            <p className="text-xs text-white/40 mb-4">
              Equipped with yfinance, Google News, and SerpAPI tools. Ask the
              agent to analyze files or check live quotes.
            </p>
            <div className="flex-1 flex justify-center items-center">
              <div className="text-center max-w-sm">
                <span className="text-4xl mb-4 block">💬</span>
                <h3 className="font-bold text-sm mb-1 text-white">
                  Full-Screen Agent Chat
                </h3>
                <p className="text-xs text-white/50 mb-4">
                  Click the purple chat balloon floating in the bottom-right
                  corner to talk to the AI agent.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 📁 FILES TAB */}
        {activeTab === "files" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 p-6 bg-white/4 border border-white/5 rounded-2xl h-fit">
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-purple-400" /> Upload File
              </h2>
              <FileUpload />
            </div>
            <div className="lg:col-span-2 p-6 bg-white/4 border border-white/5 rounded-2xl">
              <h2 className="text-sm font-bold mb-4">Workspace Documents</h2>
              <p className="text-xs text-white/50 mb-4">
                Uploaded CSV/JSON files can be parsed and analyzed by calling
                the AI Chat Assistant.
              </p>
              <div className="border border-white/5 rounded-xl p-4 bg-black/20 text-center text-xs text-white/40">
                All uploaded data is securely stored. Launch the AI agent chat
                to query, merge, or calculate records.
              </div>
            </div>
          </div>
        )}

        {/* 🔍 SEARCH TAB */}
        {activeTab === "search" && (
          <div className="space-y-4 bg-white/4 border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-400" /> Global Search
              Results
            </h2>
            <SearchSection
              infiniteScroll={true}
              initialQuery={globalSearchTrigger}
            />
          </div>
        )}
      </main>

      {/* Floating AI Chat Assistant (Always accessible) */}
      <ChatAssistant username={loggedInUser} />

      {/* User Profile Panel */}
      {showProfile && (
        <UserProfile
          username={loggedInUser}
          onClose={() => setShowProfile(false)}
          onLogout={() => {
            localStorage.removeItem("ak_session");
            setShowProfile(false);
            setIsLoggedIn(false);
            setLoggedInUser("");
          }}
        />
      )}

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.6)",
        }}
        className="w-full flex justify-center"
      >
        <div className="w-full max-w-[1600px] px-6 py-4 flex justify-between items-center text-xs text-white/40">
          <p>© {new Date().getFullYear()} Autonomous AI Workspace</p>
          <p>Structured &amp; Aligned Dashboard Layout</p>
        </div>
      </footer>
    </div>
  );
}
