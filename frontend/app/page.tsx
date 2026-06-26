"use client";
import {
  Brain,
  FolderOpen,
  LogOut,
  Newspaper,
  Search,
  TrendingUp,
  Zap,
  Bell,
  Settings,
  ChevronRight,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import ChatAssistant from "./components/ChatAssistant";
import FileUpload from "./components/FileUpload";
import LoginForm from "./components/LoginForm";
import NewsSection from "./components/NewsSection";
import SearchSection from "./components/SearchSection";
import StockSection from "./components/StockSection";
import ThemeToggle from "./components/ThemeToggle";
import { ToastContainer } from "./components/Toast";
import UserProfile from "./components/UserProfile";
import { API_BASE_URL } from "./config";

const NAV_TABS = [
  {
    id: "news",
    label: "Live News",
    shortLabel: "News",
    icon: Newspaper,
    accent: "#22d3ee",
    accentRgb: "34,211,238",
    description: "Real-time headlines",
    badge: "LIVE",
  },
  {
    id: "stocks",
    label: "Stock Market",
    shortLabel: "Stocks",
    icon: TrendingUp,
    accent: "#10b981",
    accentRgb: "16,185,129",
    description: "Live market data",
    badge: null,
  },
  {
    id: "files",
    label: "File Workspace",
    shortLabel: "Files",
    icon: FolderOpen,
    accent: "#f59e0b",
    accentRgb: "245,158,11",
    description: "Manage documents",
    badge: null,
  },
  {
    id: "search",
    label: "Global Search",
    shortLabel: "Search",
    icon: Search,
    accent: "#3b82f6",
    accentRgb: "59,130,246",
    description: "Search everything",
    badge: null,
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "Settings",
    icon: Settings,
    accent: "#94a3b8",
    accentRgb: "148,163,184",
    description: "Profile & Preferences",
    badge: null,
  }
];

export default function Home_Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [activeTab, setActiveTab] = useState("news");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchTrigger, setGlobalSearchTrigger] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [dbStatus, setDbStatus] = useState("postgres");

  useEffect(() => {
    fetch(`${API_BASE_URL}/db/status`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setDbStatus(data.database))
      .catch(() => setDbStatus("sqlite"));
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("ak_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    fetch(`${API_BASE_URL}/auth/verify`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setLoggedInUser(data.username); setIsLoggedIn(true); })
      .catch(() => {
        localStorage.removeItem("ak_session");
        fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
      })
      .finally(() => setSessionChecked(true));
  }, []);

  const handleGlobalSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (globalSearchQuery.trim()) {
      setGlobalSearchTrigger(globalSearchQuery.trim());
      setActiveTab("search");
    }
  };

  const activeTabData = NAV_TABS.find((t) => t.id === activeTab) || NAV_TABS[0];

  if (!sessionChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "#030f1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
        <div style={{ width: "52px", height: "52px", borderRadius: "18px", background: "linear-gradient(135deg, #22d3ee, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(34,211,238,0.4)" }}>
          <Brain size={26} style={{ color: "white" }} />
        </div>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2.5px solid rgba(34,211,238,0.2)", borderTopColor: "#22d3ee", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#52525b", fontSize: "12px", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase" }}>Initializing…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#030f1a]">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none filter blur-[110px] saturate-[1.8]">
          <div className="absolute top-[-15%] left-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen bg-[#0891b2] opacity-60" />
          <div className="absolute top-[10%] right-[-15%] w-[60vw] h-[60vw] rounded-full mix-blend-screen bg-[#22d3ee] opacity-40" />
          <div className="absolute bottom-[-25%] left-[10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen bg-[#0e7490] opacity-35" />
        </div>
        <div className="w-full relative z-10 flex justify-center">
          <LoginForm onLoginSuccess={(username, _token) => {
            setIsLoggedIn(true);
            setLoggedInUser(username);
            localStorage.setItem("ak_session", username);
          }} />
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ToastContainer />

      {/* ── PREMIUM TOP HEADER ── */}
      <header className="app-header">
        <div className="header-inner">
          {/* Brand */}
          <div className="header-brand">
            <div className="brand-logo">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="brand-text">
              <span className="brand-name">AI Workspace</span>
              <span className="brand-sub">Autonomous Knowledge Worker</span>
            </div>
          </div>

          {dbStatus === "sqlite" && (
            <div className="db-status-badge">
              <span className="status-dot-pulse" />
              <span>Local Offline Mode</span>
            </div>
          )}

          {/* Global Search */}
          <form onSubmit={handleGlobalSearch} className="header-search">
            <Search className="search-icon" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search news, stocks, files…"
              className="search-input"
              id="global-search-input"
            />
            <kbd className="search-kbd">⌘K</kbd>
          </form>

          {/* Actions */}
          <div className="header-actions">
            <ThemeToggle />
            <div className="header-divider" />
            <button
              type="button"
              className="header-notification-btn"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="notification-dot" />
            </button>
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="header-avatar-btn"
            >
              <div className="avatar-ring">
                <div className="avatar-inner">
                  {loggedInUser.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="avatar-info">
                <span className="avatar-name">{loggedInUser}</span>
                <span className="avatar-role">Admin</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" />
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
                } catch (err) {
                  console.error("Logout failed on server:", err);
                }
                localStorage.removeItem("ak_session");
                setIsLoggedIn(false);
                setLoggedInUser("");
              }}
              className="header-logout-btn"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── BODY: SIDEBAR + CONTENT ── */}
      <div className="app-body">
        {/* ── PREMIUM SIDEBAR ── */}
        <aside className={`app-sidebar ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
          <div className="sidebar-inner">
            {/* Nav Items */}
            <nav className="sidebar-nav">
              <div className="sidebar-section-label">NAVIGATION</div>
              {NAV_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => tab.id === "settings" ? setShowProfile(true) : setActiveTab(tab.id)}
                    className={`sidebar-nav-item ${isActive ? "sidebar-nav-active" : ""}`}
                    style={{
                      "--tab-accent": tab.accent,
                      "--tab-accent-rgb": tab.accentRgb,
                    } as React.CSSProperties}
                    title={!sidebarExpanded ? tab.label : undefined}
                  >
                    <div className="sidebar-nav-icon-wrap">
                      <Icon className="sidebar-nav-icon" />
                    </div>
                    <div className="sidebar-nav-text">
                      <span className="sidebar-nav-label">{tab.label}</span>
                      <span className="sidebar-nav-desc">{tab.description}</span>
                    </div>
                    {tab.badge && (
                      <span className="sidebar-badge">{tab.badge}</span>
                    )}
                    {isActive && <div className="sidebar-active-bar" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Collapse Toggle */}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${sidebarExpanded ? "rotate-180" : ""}`} />
          </button>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="app-main">
          {/* Content Header Bar */}
          <div className="content-topbar">
            <div className="content-topbar-left">
              <div
                className="content-tab-icon"
                style={{ background: `rgba(${activeTabData.accentRgb},0.15)`, border: `1px solid rgba(${activeTabData.accentRgb},0.3)` }}
              >
                <activeTabData.icon className="w-4 h-4" style={{ color: activeTabData.accent }} />
              </div>
              <div>
                <h2 className="content-title">
                  {activeTab === "search" ? "Search Results" : activeTabData.label}
                  {activeTab === "news" && (
                    <span className="live-pill">
                      <Zap className="w-2.5 h-2.5" /> LIVE
                    </span>
                  )}
                </h2>
                <p className="content-subtitle">
                  {activeTab === "search" ? `Results for "${globalSearchTrigger}"` : activeTabData.description}
                </p>
              </div>
            </div>
          </div>

          {/* ── TAB CONTENT ── */}
          <div className="content-body">
            {activeTab === "news" && (
              <div className="animate-fade-in tab-content-wrapper">
                <NewsSection infiniteScroll={true} />
              </div>
            )}

            {activeTab === "stocks" && (
              <div className="animate-fade-in tab-content-wrapper">
                <StockSection compact={false} />
              </div>
            )}

            {activeTab === "files" && (
              <div className="animate-fade-in tab-content-wrapper">
                <FileUpload />
              </div>
            )}

            {activeTab === "search" && (
              <div className="animate-fade-in tab-content-wrapper">
                <SearchSection infiniteScroll={true} initialQuery={globalSearchTrigger} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating AI Chat */}
      <ChatAssistant username={loggedInUser} inline={false} />
      {/* User Profile Panel */}
      {showProfile && (
        <UserProfile
          username={loggedInUser}
          onClose={() => setShowProfile(false)}
          onLogout={async () => {
            try {
              await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
            } catch (err) {
              console.error("Logout failed on server:", err);
            }
            localStorage.removeItem("ak_session");
            setShowProfile(false);
            setIsLoggedIn(false);
            setLoggedInUser("");
          }}
        />
      )}

      <style>{`
        /* ── APP SHELL ── */
        .app-shell {
          height: 100dvh;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary);
          color: var(--text-primary);
          overflow: hidden;
        }

        /* ── HEADER ── */
        .app-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: var(--bg-header);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-header);
          flex-shrink: 0;
        }
        .header-inner {
          max-width: 100%;
          padding: 0 24px;
          height: 58px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .brand-logo {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, #22d3ee 0%, #0891b2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(34,211,238,0.4);
          flex-shrink: 0;
        }
        .brand-text { display: flex; flex-direction: column; gap: 1px; }
        .brand-name { font-size: 15px; font-weight: 700; color: var(--text-primary); line-height: 1; }
        .brand-sub { font-size: 11px; color: var(--text-muted); font-weight: 500; letter-spacing: 0.3px; }

        .db-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
          flex-shrink: 0;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.05);
        }
        .status-dot-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #fbbf24;
          animation: statusPulse 1.5s infinite;
        }
        @keyframes statusPulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
        @media (max-width: 768px) {
          .db-status-badge { display: none; }
        }

        .header-search {
          flex: 1;
          max-width: 480px;
          margin: 0 auto;
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          width: 14px;
          height: 14px;
          color: var(--text-muted);
          pointer-events: none;
          flex-shrink: 0;
        }
        .search-input {
          width: 100%;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          padding: 8px 60px 8px 36px;
          font-size: 15px;
          color: var(--text-primary);
          outline: none;
          transition: all 0.2s ease;
        }
        .search-input:focus {
          background: var(--bg-hover);
          border-color: rgba(34,211,238,0.4);
          box-shadow: 0 0 0 3px rgba(34,211,238,0.08);
        }
        .search-input::placeholder { color: var(--text-muted); }
        .search-kbd {
          position: absolute;
          right: 10px;
          font-size: 12px;
          color: var(--text-muted);
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          border-radius: 5px;
          padding: 2px 6px;
          font-family: monospace;
          pointer-events: none;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .header-divider {
          width: 1px;
          height: 20px;
          background: var(--border-light);
          margin: 0 2px;
        }
        .header-notification-btn {
          position: relative;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .header-notification-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .notification-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22d3ee;
          border: 1.5px solid var(--bg-primary);
        }
 
        .header-avatar-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 4px;
          border-radius: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .header-avatar-btn:hover { background: var(--bg-hover); border-color: rgba(34,211,238,0.3); }
        .avatar-ring {
          padding: 1.5px;
          border-radius: 9px;
          background: linear-gradient(135deg, #22d3ee, #0891b2);
        }
        .avatar-inner {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          background: #1a1a2e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
          color: #d8b4fe;
          letter-spacing: 0.5px;
        }
        .avatar-info { display: flex; flex-direction: column; gap: 1px; text-align: left; }
        .avatar-name { font-size: 13px; font-weight: 700; color: var(--text-primary); line-height: 1; }
        .avatar-role { font-size: 11px; color: var(--text-muted); }

        .header-logout-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f87171;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .header-logout-btn:hover { background: rgba(239,68,68,0.15); color: #fff; }

        /* ── BODY ── */
        .app-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          height: auto;
          min-height: 0;
        }

        /* ── SIDEBAR ── */
        .app-sidebar {
          position: relative;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border-sidebar);
          transition: width 0.28s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        .sidebar-expanded { width: 220px; }
        .sidebar-collapsed { width: 64px; }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 16px 0;
          overflow-y: auto;
          overflow-x: hidden;
          gap: 4px;
          min-height: 0;
        }
        .sidebar-section-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: var(--text-muted);
          padding: 6px 16px 4px;
          white-space: nowrap;
          overflow: hidden;
        }
        .sidebar-collapsed .sidebar-section-label { opacity: 0; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 8px; }

        .sidebar-nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 12px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
          overflow: hidden;
          color: var(--text-secondary);
          text-align: left;
          width: 100%;
        }
        .sidebar-nav-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-nav-active {
          background: rgba(var(--tab-accent-rgb), 0.1) !important;
          border-color: rgba(var(--tab-accent-rgb), 0.2) !important;
          color: var(--text-primary) !important;
        }
        .sidebar-nav-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          transition: all 0.18s ease;
        }
        .sidebar-nav-active .sidebar-nav-icon-wrap {
          background: rgba(var(--tab-accent-rgb), 0.2);
          border-color: rgba(var(--tab-accent-rgb), 0.35);
        }
        .sidebar-nav-icon {
          width: 15px;
          height: 15px;
          transition: color 0.18s ease;
        }
        .sidebar-nav-active .sidebar-nav-icon {
          color: var(--tab-accent) !important;
        }
        .sidebar-nav-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          overflow: hidden;
          opacity: 1;
          transition: opacity 0.2s ease;
        }
        .sidebar-collapsed .sidebar-nav-text { opacity: 0; pointer-events: none; }
        .sidebar-nav-label {
          font-size: 14px;
          font-weight: 600;
          line-height: 1;
          color: inherit;
        }
        .sidebar-nav-desc {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1;
          white-space: nowrap;
        }
        .sidebar-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 5px;
          border-radius: 4px;
          background: rgba(34,211,238,0.25);
          color: #67e8f9;
          border: 1px solid rgba(34,211,238,0.35);
          letter-spacing: 0.5px;
          flex-shrink: 0;
          transition: opacity 0.2s;
        }
        .sidebar-collapsed .sidebar-badge { opacity: 0; }

        .sidebar-active-bar {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          border-radius: 0 3px 3px 0;
          background: var(--tab-accent);
          box-shadow: 0 0 8px var(--tab-accent);
        }

        .sidebar-collapse-btn {
          position: absolute;
          bottom: 16px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .sidebar-collapse-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* ── MAIN CONTENT ── */
        .app-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
          min-height: 0;
        }

        .content-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          border-bottom: 1px solid var(--border-topbar);
          background: var(--bg-topbar);
          flex-shrink: 0;
        }
        .content-topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .content-tab-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .content-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
          line-height: 1.2;
        }
        .content-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 1px;
        }
        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          padding: 2px 6px;
          border-radius: 5px;
          background: rgba(16,185,129,0.15);
          color: #34d399;
          border: 1px solid rgba(16,185,129,0.3);
          vertical-align: middle;
        }

        .content-body {
          flex: 1;
          overflow: hidden;
          padding: 24px;
          position: relative;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .tab-content-wrapper {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          height: 100%;
          overflow: hidden;
          max-height: 100%;
        }
        .tab-content-no-scroll {
          overflow: hidden !important;
          display: flex;
          flex-direction: column;
        }

        .chat-tab-wrapper {
          height: calc(100vh - 58px - 67px - 48px);
          min-height: 400px;
        }

        .search-tab-wrapper {
          height: 100%;
        }

        /* ── TAB TRANSITION ── */
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeSlide 0.22s ease-out forwards;
        }

        /* ── Sidebar collapse: hide text ── */
        .sidebar-collapsed .sidebar-nav-text,
        .sidebar-collapsed .sidebar-badge,
        .sidebar-collapsed .sidebar-section-label {
          opacity: 0;
          pointer-events: none;
        }
        .sidebar-collapsed .sidebar-nav-item {
          justify-content: center;
          padding: 9px;
        }
        .sidebar-collapsed .sidebar-nav-icon-wrap {
          margin: 0;
        }

        @media (max-width: 768px) {
          .app-sidebar { display: none; }
          .header-search { display: none; }
          .avatar-info { display: none; }
          .brand-text { display: none; }
          .app-body { height: auto; }
          .content-body { padding: 16px; }
        }
      `}</style>
    </div>
  );
}
