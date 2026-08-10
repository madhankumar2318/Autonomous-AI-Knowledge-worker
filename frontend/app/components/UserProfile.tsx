"use client";
import {
  User,
  Mail,
  Phone,
  Shield,
  Clock,
  Edit3,
  Save,
  X,
  CheckCircle,
  LogOut,
  KeyRound,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  Zap,
  Palette,
  Bell,
  Database,
  Download,
  Trash2,
  Volume2,
  VolumeX,
  RefreshCw,
  TrendingUp,
  LayoutGrid,
  Cpu,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { API_BASE_URL } from "../config";

type SettingsTab = "profile" | "appearance" | "ai_settings" | "notifications" | "data";

interface UserProfileProps {
  username: string;
  onClose: () => void;
  onLogout: () => void;
}
interface ProfileData {
  id: number;
  username: string;
  name: string;
  email: string;
  mobile: string;
}

// ─── AI Persona Presets ───────────────────────────────────────────────────────
const AI_PERSONAS = [
  {
    id: "financial",
    icon: "📊",
    label: "Financial Analyst",
    prompt:
      "You are a senior financial analyst. Always structure answers with key metrics first (P/E ratio, EPS, market cap, revenue growth). Provide concise risk factors and investment outlook. Use bullet points for financial data and always cite figures precisely.",
  },
  {
    id: "software",
    icon: "💻",
    label: "Software Architect",
    prompt:
      "You are a senior software architect with 10+ years experience. Provide clean, production-ready code with TypeScript best practices. Explain architectural patterns, trade-offs, and scalability considerations. Always include error handling and type safety.",
  },
  {
    id: "executive",
    icon: "⚡",
    label: "Executive Briefing",
    prompt:
      "You are an executive assistant. Provide all responses as concise, executive-level summaries in 3-5 bullet points max. No technical jargon. Focus on business impact, key decisions, and actionable recommendations. Be direct and brief.",
  },
  {
    id: "legal",
    icon: "⚖️",
    label: "Legal Advisor",
    prompt:
      "You are a legal research assistant. Identify key clauses, compliance risks, and regulatory considerations. Always highlight important legal terms and potential liabilities. Note jurisdiction-specific differences where applicable. This is not legal advice.",
  },
];

// ─── Theme Configs ────────────────────────────────────────────────────────────
const THEMES = [
  { id: "dark", icon: Moon, label: "Dark Glass", desc: "Default sleek dark mode" },
  { id: "oled", icon: Monitor, label: "OLED Black", desc: "True black, saves battery" },
  { id: "light", icon: Sun, label: "Light Elegance", desc: "Clean & minimal light" },
  { id: "cyberpunk", icon: Zap, label: "Cyberpunk Neon", desc: "Vibrant neon glow" },
];

// ─── Accent Colors ─────────────────────────────────────────────────────────────
const ACCENTS = [
  { id: "cyan", color: "#22d3ee", label: "Cyan" },
  { id: "purple", color: "#a855f7", label: "Purple" },
  { id: "emerald", color: "#10b981", label: "Emerald" },
  { id: "gold", color: "#f59e0b", label: "Gold" },
  { id: "rose", color: "#f43f5e", label: "Rose" },
];

// ─── Refresh Rate Options ──────────────────────────────────────────────────────
const REFRESH_RATES = [
  { id: "30s", label: "30 seconds", ms: 30000 },
  { id: "1m", label: "1 minute", ms: 60000 },
  { id: "5m", label: "5 minutes", ms: 300000 },
  { id: "manual", label: "Manual only", ms: 0 },
];

export default function UserProfile({ username, onClose, onLogout }: UserProfileProps) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // ── AI Settings state ───────────────────────────────────────────────────────
  const [defaultModel, setDefaultModel] = useState("llama-70b");
  const [temperature, setTemperature] = useState(0.1);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(100);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ── Password state ──────────────────────────────────────────────────────────
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  // ── Appearance state ────────────────────────────────────────────────────────
  const [currentTheme, setCurrentTheme] = useState("dark");
  const [currentAccent, setCurrentAccent] = useState("cyan");
  const [density, setDensity] = useState<"compact" | "balanced" | "spacious">("balanced");
  const [reducedMotion, setReducedMotion] = useState(false);

  // ── Notifications state ─────────────────────────────────────────────────────
  const [refreshRate, setRefreshRate] = useState("5m");
  const [chimeEnabled, setChimeEnabled] = useState(false);
  const [stockAlertsEnabled, setStockAlertsEnabled] = useState(false);
  const [stockAlertThreshold, setStockAlertThreshold] = useState(5);

  // ── Data & Storage state ────────────────────────────────────────────────────
  const [clearSearchConfirm, setClearSearchConfirm] = useState(false);
  const [clearChatConfirm, setClearChatConfirm] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ searches: 0, chats: 0, total: 0 });

  // ── Session info ────────────────────────────────────────────────────────────
  const sessionTime = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  )[0];
  const sessionDate = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const isAdmin = username === "admin";
  const initials = (profile?.name || username)
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  // ── Load everything on mount ────────────────────────────────────────────────
  useEffect(() => { fetchProfile(); fetchSettings(); loadAppearancePrefs(); loadNotifPrefs(); calcStorageInfo(); }, [username]);

  // ── Load appearance from localStorage ──────────────────────────────────────
  function loadAppearancePrefs() {
    const t = localStorage.getItem("ak_theme") || "dark";
    const a = localStorage.getItem("ak_accent") || "cyan";
    const d = (localStorage.getItem("ak_density") as "compact" | "balanced" | "spacious") || "balanced";
    const rm = localStorage.getItem("ak_reduced_motion") === "true";
    setCurrentTheme(t);
    setCurrentAccent(a);
    setDensity(d);
    setReducedMotion(rm);
  }

  // ── Load notification prefs from localStorage ───────────────────────────────
  function loadNotifPrefs() {
    setRefreshRate(localStorage.getItem("ak_refresh_rate") || "5m");
    setChimeEnabled(localStorage.getItem("ak_chime") === "true");
    setStockAlertsEnabled(localStorage.getItem("ak_stock_alerts") === "true");
    setStockAlertThreshold(parseInt(localStorage.getItem("ak_stock_alert_threshold") || "5"));
  }

  // ── Calculate localStorage usage ────────────────────────────────────────────
  function calcStorageInfo() {
    const searches = JSON.stringify(localStorage.getItem("ak_recent_searches") || "").length;
    const chats = JSON.stringify(localStorage.getItem("ak_chat_history") || "").length;
    setStorageInfo({ searches, chats, total: searches + chats });
  }

  // ── Apply theme immediately across app ─────────────────────────────────────
  const applyTheme = useCallback((themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("ak_theme", themeId);
    document.documentElement.setAttribute("data-theme", themeId);
    window.dispatchEvent(new CustomEvent("ak-theme-changed", { detail: { theme: themeId } }));
  }, []);

  // ── Apply accent color ──────────────────────────────────────────────────────
  const applyAccent = useCallback((accentId: string) => {
    const accent = ACCENTS.find((a) => a.id === accentId);
    if (!accent) return;
    setCurrentAccent(accentId);
    localStorage.setItem("ak_accent", accentId);
    document.documentElement.style.setProperty("--accent-primary", accent.color);
    document.documentElement.style.setProperty("--accent-primary-hover", accent.color + "cc");
    window.dispatchEvent(new CustomEvent("ak-accent-changed", { detail: { accent: accentId, color: accent.color } }));
  }, []);

  // ── Apply density ───────────────────────────────────────────────────────────
  const applyDensity = useCallback((d: "compact" | "balanced" | "spacious") => {
    setDensity(d);
    localStorage.setItem("ak_density", d);
    document.documentElement.setAttribute("data-density", d);
  }, []);

  // ── Apply reduced motion ────────────────────────────────────────────────────
  const applyReducedMotion = useCallback((val: boolean) => {
    setReducedMotion(val);
    localStorage.setItem("ak_reduced_motion", String(val));
    document.documentElement.setAttribute("data-reduced-motion", String(val));
  }, []);

  // ── Save notification prefs ─────────────────────────────────────────────────
  function saveNotifPrefs(updates: Partial<{ refreshRate: string; chime: boolean; stockAlerts: boolean; threshold: number }>) {
    if (updates.refreshRate !== undefined) {
      setRefreshRate(updates.refreshRate);
      localStorage.setItem("ak_refresh_rate", updates.refreshRate);
      const found = REFRESH_RATES.find((r) => r.id === updates.refreshRate);
      window.dispatchEvent(new CustomEvent("ak-refresh-rate-changed", { detail: { ms: found?.ms || 300000 } }));
    }
    if (updates.chime !== undefined) {
      setChimeEnabled(updates.chime);
      localStorage.setItem("ak_chime", String(updates.chime));
    }
    if (updates.stockAlerts !== undefined) {
      setStockAlertsEnabled(updates.stockAlerts);
      localStorage.setItem("ak_stock_alerts", String(updates.stockAlerts));
    }
    if (updates.threshold !== undefined) {
      setStockAlertThreshold(updates.threshold);
      localStorage.setItem("ak_stock_alert_threshold", String(updates.threshold));
    }
    showToast("Notification preferences saved!", "ok");
  }

  // ── Export data as JSON download ────────────────────────────────────────────
  function exportData(key: string, filename: string) {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : [];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`${filename} downloaded!`, "ok");
  }

  // ── Clear history ───────────────────────────────────────────────────────────
  function clearHistory(key: string, label: string) {
    localStorage.removeItem(key);
    calcStorageInfo();
    setClearSearchConfirm(false);
    setClearChatConfirm(false);
    showToast(`${label} cleared successfully.`, "ok");
  }

  async function fetchSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDefaultModel(data.default_model || "llama-70b");
        setTemperature(data.temperature ?? 0.1);
        setSystemPrompt(data.system_prompt || "");
        setChunkSize(data.chunk_size ?? 800);
        setChunkOverlap(data.chunk_overlap ?? 100);
      }
    } catch (err) {
      console.error("Failed to load user settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ default_model: defaultModel, temperature, system_prompt: systemPrompt, chunk_size: chunkSize, chunk_overlap: chunkOverlap }),
      });
      if (!res.ok) throw new Error();
      showToast("AI Settings saved successfully!", "ok");
    } catch {
      showToast("Failed to save AI Settings.", "err");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data);
      setEditName(data.name || "");
      setEditEmail(data.email || "");
      setEditMobile(data.mobile || "");
    } catch {
      setProfile({ id: 0, username, name: "", email: "", mobile: "" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", editName); fd.append("email", editEmail); fd.append("mobile", editMobile);
      const res = await fetch(`${API_BASE_URL}/auth/profile`, { method: "PUT", credentials: "include", body: fd });
      if (!res.ok) throw new Error();
      setProfile((p) => p ? { ...p, name: editName, email: editEmail, mobile: editMobile } : p);
      setEditing(false);
      showToast("Profile updated successfully!", "ok");
    } catch {
      showToast("Save failed. Please try again.", "err");
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleChangePassword() {
    setPwError("");
    if (!oldPw) return setPwError("Please enter your current password.");
    if (newPw.length < 8) return setPwError("New password must be at least 8 characters.");
    if (newPw !== confirmPw) return setPwError("New passwords do not match.");
    setPwSaving(true);
    try {
      const fd = new FormData();
      fd.append("old_password", oldPw); fd.append("new_password", newPw);
      const res = await fetch(`${API_BASE_URL}/auth/password`, { method: "PUT", credentials: "include", body: fd });
      const data = await res.json();
      if (!res.ok) { setPwError(data.detail || "Failed to change password."); return; }
      setOldPw(""); setNewPw(""); setConfirmPw(""); setShowPwForm(false);
      showToast("Password changed successfully! 🔒", "ok");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwSaving(false);
    }
  }

  // ── Field renderer for Profile tab ─────────────────────────────────────────
  const field = (
    label: string, value: string | undefined, color: string,
    icon: React.ReactNode, editVal: string, setEdit: (v: string) => void, placeholder: string,
  ) => (
    <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: editing ? "flex-start" : "center", gap: "14px" }}>
      <div style={{ width: "38px", height: "38px", borderRadius: "11px", flexShrink: 0, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: editing ? "2px" : 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 5px", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>{label}</p>
        {editing ? (
          <input value={editVal} onChange={(e) => setEdit(e.target.value)} placeholder={placeholder}
            style={{ width: "100%", background: "var(--bg-surface)", border: `1px solid ${color}55`, borderRadius: "10px", padding: "9px 13px", color: "var(--text-primary)", fontSize: "15px", fontWeight: 500, outline: "none", boxSizing: "border-box" }}
            onFocus={(e) => (e.target.style.borderColor = color)}
            onBlur={(e) => (e.target.style.borderColor = `${color}55`)} />
        ) : (
          <p style={{ margin: 0, color: value ? "var(--text-primary)" : "var(--text-muted)", fontSize: "16px", fontWeight: value ? 600 : 400, fontStyle: value ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value || "Not set"}
          </p>
        )}
      </div>
    </div>
  );

  // ── Section header helper ───────────────────────────────────────────────────
  const sectionHeader = (icon: React.ReactNode, title: string, subtitle?: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
      <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "15px", fontWeight: 700 }}>{title}</p>
        {subtitle && <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>{subtitle}</p>}
      </div>
    </div>
  );

  // ── Toggle switch helper ────────────────────────────────────────────────────
  const Toggle = ({ checked, onChange, color = "#22d3ee" }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) => (
    <button type="button" onClick={() => onChange(!checked)} style={{ position: "relative", width: "46px", height: "26px", borderRadius: "13px", background: checked ? color : "rgba(255,255,255,0.1)", border: `1px solid ${checked ? color + "80" : "rgba(255,255,255,0.15)"}`, cursor: "pointer", transition: "all 0.25s ease", flexShrink: 0, padding: 0 }}>
      <div style={{ position: "absolute", top: "3px", left: checked ? "22px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "white", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)" }} />
    </button>
  );

  const TABS: { id: SettingsTab; icon: string; label: string }[] = [
    { id: "profile", icon: "👤", label: "Profile" },
    { id: "appearance", icon: "🎨", label: "Appearance" },
    { id: "ai_settings", icon: "🤖", label: "AI Engine" },
    { id: "notifications", icon: "🔔", label: "Alerts" },
    { id: "data", icon: "💾", label: "Data" },
  ];

  return (
    <>
      {/* Dim backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />

      {/* Panel */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: "100%", maxWidth: "490px", display: "flex", flexDirection: "column", background: "var(--bg-sidebar)", borderLeft: "1px solid var(--border-medium)", boxShadow: "-40px 0 100px rgba(0,0,0,0.9)", animation: "panelIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards" }}>

        {/* ── STICKY HEADER ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", background: "var(--bg-header)", backdropFilter: "blur(24px)", borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "linear-gradient(135deg,rgba(37,99,235,.25),rgba(13,148,136,.2))", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={15} style={{ color: "#60a5fa" }} />
            </div>
            <span style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: "17px" }}>Settings & Profile</span>
          </div>
          <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "9px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2.5px solid rgba(34,211,238,0.2)", borderTopColor: "#22d3ee", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* ── HERO SECTION ── */}
            <div style={{ position: "relative", overflow: "hidden", padding: "36px 22px 28px", textAlign: "center", background: "linear-gradient(180deg, var(--bg-header) 0%, var(--bg-sidebar) 100%)", borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: "0%", left: "20%", width: "220px", height: "220px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: "0%", right: "15%", width: "180px", height: "180px", borderRadius: "50%", background: "radial-gradient(circle, rgba(13,148,136,0.1) 0%, transparent 70%)", filter: "blur(35px)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", inset: 0, opacity: 0.07, backgroundImage: "radial-gradient(var(--text-primary) 1px, transparent 1px)", backgroundSize: "24px 24px", pointerEvents: "none" }} />

              {/* Avatar */}
              <div style={{ position: "relative", display: "inline-block", marginBottom: "16px" }}>
                <div style={{ position: "absolute", inset: "-4px", borderRadius: "28px", background: "linear-gradient(135deg, #2563eb, #0d9488, #2563eb)", backgroundSize: "200% 200%", animation: "gradientShift 3s ease infinite", padding: "2px" }} />
                <div style={{ position: "relative", zIndex: 1, width: "80px", height: "80px", borderRadius: "22px", background: "linear-gradient(145deg, #1d4ed8 0%, #0d9488 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", fontWeight: 900, color: "white", letterSpacing: "-1px", boxShadow: "0 14px 36px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.3)" }}>
                  {initials}
                </div>
              </div>

              <h2 style={{ margin: "0 0 4px", color: "var(--text-primary)", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>{profile?.name || username}</h2>
              <p style={{ margin: "0 0 14px", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>@{username}</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "6px 14px", borderRadius: "999px", background: isAdmin ? "rgba(250,204,21,0.1)" : "rgba(37,99,235,0.12)", border: isAdmin ? "1px solid rgba(250,204,21,0.3)" : "1px solid rgba(37,99,235,0.3)" }}>
                <Shield size={12} style={{ color: isAdmin ? "#fbbf24" : "#60a5fa" }} />
                <span style={{ color: isAdmin ? "#fde68a" : "#93c5fd", fontSize: "13px", fontWeight: 800, letterSpacing: "0.5px" }}>{isAdmin ? "Administrator" : "Standard User"}</span>
              </div>

              {/* Stats Row */}
              <div style={{ display: "flex", gap: "1px", marginTop: "22px", borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                {[{ label: "Account ID", value: `#${String(profile?.id || 1).padStart(3, "0")}` }, { label: "Session", value: "Active" }, { label: "Role", value: isAdmin ? "Admin" : "User" }].map(({ label, value }, i) => (
                  <div key={i} style={{ flex: 1, padding: "12px 8px", background: "var(--bg-secondary)", textAlign: "center", borderRight: i < 2 ? "1px solid var(--border-light)" : "none" }}>
                    <p style={{ margin: "0 0 3px", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>{label}</p>
                    <p style={{ margin: 0, color: value === "Active" ? "#34d399" : "var(--text-primary)", fontSize: "15px", fontWeight: 800 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── TAB BAR (5 tabs, scrollable) ── */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border-light)", flexShrink: 0, overflowX: "auto", scrollbarWidth: "none" }} className="scrollbar-none">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: "0 0 auto", minWidth: "80px", padding: "13px 10px", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent-primary, #22d3ee)" : "transparent"}`, color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 700, fontSize: "12px", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
                  <span style={{ marginRight: "4px" }}>{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>

            {/* ── TAB BODY ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "22px", WebkitOverflowScrolling: "touch" }}>

              {/* Toast */}
              {toast && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "12px", marginBottom: "18px", background: toast.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${toast.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, animation: "fadeUp 0.3s ease" }}>
                  <CheckCircle size={15} style={{ color: toast.type === "ok" ? "#34d399" : "#f87171", flexShrink: 0 }} />
                  <span style={{ color: toast.type === "ok" ? "#34d399" : "#f87171", fontSize: "14px", fontWeight: 600 }}>{toast.msg}</span>
                </div>
              )}

              {/* ═══════════════════ TAB 1 — PROFILE ═══════════════════ */}
              {activeTab === "profile" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Session card */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", background: "var(--bg-secondary)" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "11px", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Clock size={16} style={{ color: "#60a5fa" }} />
                      </div>
                      <div>
                        <p style={{ margin: "0 0 2px", color: "var(--text-primary)", fontSize: "15px", fontWeight: 700 }}>{sessionDate}</p>
                        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>Logged in at {sessionTime}</p>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", padding: "5px 11px", borderRadius: "999px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", flexShrink: 0 }}>
                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981", animation: "pulse 2s infinite" }} />
                        <span style={{ color: "#34d399", fontSize: "13px", fontWeight: 700 }}>Live</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Sparkles size={13} style={{ color: "#60a5fa" }} />
                        <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>Account Details</span>
                      </div>
                      {!editing ? (
                        <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 13px", borderRadius: "8px", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)", color: "#60a5fa", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                          <Edit3 size={12} /> Edit
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => setEditing(false)} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 11px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                            <X size={12} /> Cancel
                          </button>
                          <button onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 14px", borderRadius: "8px", background: "linear-gradient(135deg,#2563eb,#0d9488)", border: "none", color: "white", fontSize: "13px", fontWeight: 700, cursor: saving ? "wait" : "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.35)" }}>
                            <Save size={12} /> {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Username locked */}
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 22px", borderBottom: "1px solid var(--border-light)" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "11px", background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <KeyRound size={15} style={{ color: "#eab308" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 4px", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>Username</p>
                        <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "15px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{username}</p>
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.5px", padding: "3px 7px", borderRadius: "5px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#f59e0b", flexShrink: 0 }}>LOCKED</span>
                    </div>
                    {field("Full Name", profile?.name, "#3b82f6", <User size={15} style={{ color: "#3b82f6" }} />, editName, setEditName, "Your full name")}
                    {field("Email Address", profile?.email, "#2dd4bf", <Mail size={15} style={{ color: "#2dd4bf" }} />, editEmail, setEditEmail, "your@email.com")}
                    {field("Mobile Number", profile?.mobile, "#a78bfa", <Phone size={15} style={{ color: "#a78bfa" }} />, editMobile, setEditMobile, "+91 12345 67890")}
                  </div>

                  {/* Change Password */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                    <button type="button" onClick={() => { setShowPwForm((v) => !v); setPwError(""); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", background: "var(--bg-secondary)", border: "none", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Lock size={13} style={{ color: "#22d3ee" }} />
                        </div>
                        <span style={{ color: "#e2e8f0", fontSize: "15px", fontWeight: 700 }}>Change Password</span>
                      </div>
                      <ChevronDown size={16} style={{ color: "var(--text-secondary)", transform: showPwForm ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </button>
                    {showPwForm && (
                      <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--border-light)" }}>
                        {[
                          { label: "Current Password", val: oldPw, set: setOldPw, show: showOld, toggle: () => setShowOld((v) => !v), placeholder: "Enter current password" },
                          { label: "New Password", val: newPw, set: setNewPw, show: showNew, toggle: () => setShowNew((v) => !v), placeholder: "Min. 8 characters" },
                        ].map(({ label, val, set, show, toggle, placeholder }) => (
                          <div key={label}>
                            <p style={{ margin: "0 0 6px", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase" }}>{label}</p>
                            <div style={{ position: "relative" }}>
                              <input type={show ? "text" : "password"} value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                                style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "9px 40px 9px 13px", color: "var(--text-primary)", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
                                onFocus={(e) => (e.target.style.borderColor = "rgba(34,211,238,0.6)")}
                                onBlur={(e) => (e.target.style.borderColor = "var(--border-light)")} />
                              <button type="button" onClick={toggle} style={{ position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 0 }}>
                                {show ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        ))}
                        <div>
                          <p style={{ margin: "0 0 6px", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase" }}>Confirm New Password</p>
                          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                            style={{ width: "100%", background: "var(--bg-surface)", border: `1px solid ${confirmPw && confirmPw !== newPw ? "rgba(239,68,68,0.5)" : "var(--border-light)"}`, borderRadius: "10px", padding: "9px 13px", color: "var(--text-primary)", fontSize: "15px", outline: "none", boxSizing: "border-box" }} />
                          {confirmPw && confirmPw !== newPw && <p style={{ margin: "5px 0 0", color: "#f87171", fontSize: "13px" }}>Passwords do not match</p>}
                        </div>
                        {pwError && <div style={{ padding: "10px 13px", borderRadius: "9px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}><p style={{ margin: 0, color: "#f87171", fontSize: "14px", fontWeight: 600 }}>⚠ {pwError}</p></div>}
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button type="button" onClick={() => { setShowPwForm(false); setOldPw(""); setNewPw(""); setConfirmPw(""); setPwError(""); }} style={{ flex: 1, padding: "9px", borderRadius: "9px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                          <button type="button" onClick={handleChangePassword} disabled={pwSaving} style={{ flex: 2, padding: "9px", borderRadius: "9px", background: "linear-gradient(135deg, #0891b2, #22d3ee)", border: "none", color: "white", fontSize: "14px", fontWeight: 700, cursor: pwSaving ? "wait" : "pointer", boxShadow: "0 4px 12px rgba(34,211,238,0.3)" }}>
                            {pwSaving ? "Changing…" : "🔒 Change Password"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign Out */}
                  <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", borderRadius: "14px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.14)", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.13)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.28)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.07)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.14)"; }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <LogOut size={17} style={{ color: "#f87171" }} />
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", color: "#f87171", fontSize: "16px", fontWeight: 800 }}>Sign Out</p>
                      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>End your current session securely</p>
                    </div>
                  </button>
                </div>
              )}

              {/* ═══════════════════ TAB 2 — APPEARANCE ═══════════════════ */}
              {activeTab === "appearance" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

                  {/* Theme Mode */}
                  <div>
                    {sectionHeader(<Palette size={16} style={{ color: "#22d3ee" }} />, "Theme Mode", "Choose your visual style")}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {THEMES.map((t) => {
                        const Icon = t.icon;
                        const isSel = currentTheme === t.id;
                        return (
                          <button key={t.id} type="button" onClick={() => applyTheme(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", padding: "14px", borderRadius: "14px", background: isSel ? "rgba(34,211,238,0.1)" : "var(--bg-secondary)", border: `2px solid ${isSel ? "rgba(34,211,238,0.5)" : "var(--border-light)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s ease", position: "relative" }}>
                            {isSel && <div style={{ position: "absolute", top: "8px", right: "8px", width: "8px", height: "8px", borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 6px #22d3ee" }} />}
                            <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: isSel ? "rgba(34,211,238,0.15)" : "var(--bg-surface)", border: `1px solid ${isSel ? "rgba(34,211,238,0.3)" : "var(--border-light)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon size={15} style={{ color: isSel ? "#22d3ee" : "var(--text-secondary)" }} />
                            </div>
                            <div>
                              <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 700, color: isSel ? "#22d3ee" : "var(--text-primary)" }}>{t.label}</p>
                              <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>{t.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div>
                    {sectionHeader(<Sparkles size={16} style={{ color: "#a855f7" }} />, "Accent Color", "Your signature UI highlight color")}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      {ACCENTS.map((a) => {
                        const isSel = currentAccent === a.id;
                        return (
                          <button key={a.id} type="button" onClick={() => applyAccent(a.id)} title={a.label} style={{ width: "42px", height: "42px", borderRadius: "12px", background: a.color, border: isSel ? `3px solid white` : "3px solid transparent", cursor: "pointer", boxShadow: isSel ? `0 0 0 2px ${a.color}, 0 4px 12px ${a.color}55` : "none", transition: "all 0.2s ease", transform: isSel ? "scale(1.1)" : "scale(1)" }} />
                        );
                      })}
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Selected: <strong style={{ color: "var(--accent-primary, #22d3ee)" }}>{ACCENTS.find((a) => a.id === currentAccent)?.label}</strong></p>
                  </div>

                  {/* UI Density */}
                  <div>
                    {sectionHeader(<LayoutGrid size={16} style={{ color: "#10b981" }} />, "UI Density", "Adjust information density across panels")}
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["compact", "balanced", "spacious"] as const).map((d) => (
                        <button key={d} type="button" onClick={() => applyDensity(d)} style={{ flex: 1, padding: "10px 6px", borderRadius: "11px", background: density === d ? "rgba(16,185,129,0.12)" : "var(--bg-secondary)", border: `1px solid ${density === d ? "rgba(16,185,129,0.4)" : "var(--border-light)"}`, color: density === d ? "#34d399" : "var(--text-secondary)", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", textTransform: "capitalize" }}>
                          {d === "compact" ? "🗜 " : d === "balanced" ? "⚖️ " : "🔲 "}{d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reduced Motion */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: "14px", background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}>
                    <div>
                      <p style={{ margin: "0 0 3px", color: "var(--text-primary)", fontSize: "14px", fontWeight: 700 }}>Reduced Motion</p>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>Disable heavy CSS animations for better performance on low-end devices</p>
                    </div>
                    <Toggle checked={reducedMotion} onChange={applyReducedMotion} color="#f59e0b" />
                  </div>
                </div>
              )}

              {/* ═══════════════════ TAB 3 — AI ENGINE ═══════════════════ */}
              {activeTab === "ai_settings" && (
                settingsLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "2px solid rgba(34,211,238,0.2)", borderTopColor: "#22d3ee", animation: "spin 0.7s linear infinite" }} />
                    <span style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-secondary)" }}>Loading AI settings...</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

                    {/* AI Persona Presets */}
                    <div>
                      {sectionHeader(<Cpu size={16} style={{ color: "#c084fc" }} />, "AI Persona Presets", "One-click system prompt templates")}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {AI_PERSONAS.map((p) => (
                          <button key={p.id} type="button" onClick={() => setSystemPrompt(p.prompt)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", borderRadius: "12px", background: systemPrompt === p.prompt ? "rgba(168,85,247,0.12)" : "var(--bg-secondary)", border: `1px solid ${systemPrompt === p.prompt ? "rgba(168,85,247,0.4)" : "var(--border-light)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                            <span style={{ fontSize: "20px" }}>{p.icon}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: systemPrompt === p.prompt ? "#c084fc" : "var(--text-primary)", lineHeight: 1.3 }}>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* LLM Model */}
                    <div>
                      {sectionHeader(<Sparkles size={16} style={{ color: "#22d3ee" }} />, "Default LLM Model", "AI model used for chat and summaries")}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                        {[
                          { id: "llama-70b", name: "Llama 3.3 70b (Groq)", desc: "Hyper-fast versatile reasoning agent" },
                          { id: "gemini-flash", name: "Gemini 2.5 Flash", desc: "Balanced model optimized for speed" },
                          { id: "gemini-pro", name: "Gemini 2.5 Pro", desc: "Deep analytical model for complex RAG tasks" },
                        ].map((m) => {
                          const isSel = defaultModel === m.id;
                          return (
                            <button key={m.id} type="button" onClick={() => setDefaultModel(m.id)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "12px 14px", borderRadius: "12px", background: isSel ? "rgba(34,211,238,0.08)" : "var(--bg-secondary)", border: `1px solid ${isSel ? "rgba(34,211,238,0.35)" : "var(--border-light)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s ease" }}>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: isSel ? "#22d3ee" : "var(--text-primary)" }}>{m.name}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{m.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Temperature */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "1px" }}>Temperature (Creativity)</label>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#22d3ee", background: "rgba(34,211,238,0.1)", padding: "2px 8px", borderRadius: "6px" }}>{temperature.toFixed(1)}</span>
                      </div>
                      <input type="range" min="0.0" max="1.0" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#22d3ee", cursor: "pointer" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        <span>Analytical (0.0)</span><span>Balanced (0.5)</span><span>Creative (1.0)</span>
                      </div>
                    </div>

                    {/* System Prompt */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "1px" }}>System Instructions</label>
                      <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Leave empty to use default assistant instructions..." rows={4}
                        style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "12px 13px", color: "var(--text-primary)", fontSize: "13px", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>

                    {/* RAG Chunk Settings */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "12px", letterSpacing: "1px" }}>RAG Document Ingestion</label>
                      {[
                        { label: "Chunk Size (chars)", val: chunkSize, set: setChunkSize, min: 200, max: 2000, step: 50, unit: "chars" },
                        { label: "Chunk Overlap (chars)", val: chunkOverlap, set: setChunkOverlap, min: 0, max: 500, step: 10, unit: "chars" },
                      ].map(({ label, val, set, min, max, step, unit }) => (
                        <div key={label} style={{ marginBottom: "14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{label}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#22d3ee" }}>{val} {unit}</span>
                          </div>
                          <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#22d3ee", cursor: "pointer" }} />
                        </div>
                      ))}
                    </div>

                    {/* Save Button */}
                    <button onClick={handleSaveSettings} disabled={settingsSaving} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)", color: "white", fontWeight: 700, border: "none", cursor: settingsSaving ? "wait" : "pointer", boxShadow: "0 4px 16px rgba(34,211,238,0.25)", fontSize: "14px" }}>
                      {settingsSaving ? "Saving..." : "💾 Save AI Configuration"}
                    </button>
                  </div>
                )
              )}

              {/* ═══════════════════ TAB 4 — NOTIFICATIONS ═══════════════════ */}
              {activeTab === "notifications" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

                  {/* News Refresh Rate */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                    <div style={{ padding: "14px 18px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                      {sectionHeader(<RefreshCw size={15} style={{ color: "#38bdf8" }} />, "Live Feed Auto-Refresh", "How often news & market data auto-refreshes")}
                    </div>
                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {REFRESH_RATES.map((r) => (
                        <button key={r.id} type="button" onClick={() => saveNotifPrefs({ refreshRate: r.id })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: "10px", background: refreshRate === r.id ? "rgba(56,189,248,0.1)" : "var(--bg-surface)", border: `1px solid ${refreshRate === r.id ? "rgba(56,189,248,0.35)" : "var(--border-light)"}`, cursor: "pointer", transition: "all 0.2s" }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: refreshRate === r.id ? "#38bdf8" : "var(--text-primary)" }}>{r.label}</span>
                          {refreshRate === r.id && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 6px #38bdf8" }} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Completion Chime */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: "14px", background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {chimeEnabled ? <Volume2 size={15} style={{ color: "#c084fc" }} /> : <VolumeX size={15} style={{ color: "#64748b" }} />}
                      </div>
                      <div>
                        <p style={{ margin: "0 0 2px", color: "var(--text-primary)", fontSize: "14px", fontWeight: 700 }}>AI Completion Chime</p>
                        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>Subtle sound when AI finishes a long response</p>
                      </div>
                    </div>
                    <Toggle checked={chimeEnabled} onChange={(v) => saveNotifPrefs({ chime: v })} color="#c084fc" />
                  </div>

                  {/* Stock Price Alerts */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "var(--bg-secondary)", borderBottom: stockAlertsEnabled ? "1px solid var(--border-light)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <TrendingUp size={15} style={{ color: "#34d399" }} />
                        </div>
                        <div>
                          <p style={{ margin: "0 0 2px", color: "var(--text-primary)", fontSize: "14px", fontWeight: 700 }}>Stock Price Alerts</p>
                          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>Browser alert when stock moves by threshold</p>
                        </div>
                      </div>
                      <Toggle checked={stockAlertsEnabled} onChange={(v) => saveNotifPrefs({ stockAlerts: v })} color="#10b981" />
                    </div>
                    {stockAlertsEnabled && (
                      <div style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Alert Threshold</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#34d399" }}>±{stockAlertThreshold}%</span>
                        </div>
                        <input type="range" min="1" max="20" step="1" value={stockAlertThreshold} onChange={(e) => saveNotifPrefs({ threshold: parseInt(e.target.value) })} style={{ width: "100%", accentColor: "#10b981", cursor: "pointer" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                          <span>Sensitive (1%)</span><span>Moderate (10%)</span><span>Major (20%)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: "11px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <Bell size={14} style={{ color: "#38bdf8", marginTop: "1px", flexShrink: 0 }} />
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.5 }}>Notification preferences are saved automatically and persist across sessions.</p>
                  </div>
                </div>
              )}

              {/* ═══════════════════ TAB 5 — DATA & STORAGE ═══════════════════ */}
              {activeTab === "data" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

                  {/* Storage Usage */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                    <div style={{ padding: "14px 18px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                      {sectionHeader(<Database size={15} style={{ color: "#22d3ee" }} />, "Local Storage Usage", "Data stored in your browser")}
                    </div>
                    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {[
                        { label: "Search History", size: storageInfo.searches, color: "#a855f7" },
                        { label: "Chat History", size: storageInfo.chats, color: "#38bdf8" },
                      ].map(({ label, size, color }) => (
                        <div key={label}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color }}>{size > 0 ? `~${(size / 1024).toFixed(1)} KB` : "Empty"}</span>
                          </div>
                          <div style={{ height: "6px", borderRadius: "3px", background: "var(--bg-surface)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: size > 0 ? `${Math.min((size / 5000) * 100, 100)}%` : "0%", background: color, borderRadius: "3px", transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export Data */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
                    <div style={{ padding: "14px 18px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                      {sectionHeader(<Download size={15} style={{ color: "#34d399" }} />, "Export Data", "Download your data as JSON files")}
                    </div>
                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {[
                        { label: "📋 Export Search History", key: "ak_recent_searches", file: "search_history.json" },
                        { label: "💬 Export Chat History", key: "ak_chat_history", file: "chat_history.json" },
                      ].map(({ label, key, file }) => (
                        <button key={key} type="button" onClick={() => exportData(key, file)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", cursor: "pointer", color: "var(--text-primary)", fontSize: "14px", fontWeight: 600, transition: "all 0.2s", textAlign: "left" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.borderColor = "var(--border-light)"; }}>
                          <Download size={14} style={{ color: "#34d399" }} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clear Data */}
                  <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.04)", borderBottom: "1px solid rgba(239,68,68,0.15)" }}>
                      {sectionHeader(<Trash2 size={15} style={{ color: "#f87171" }} />, "Clear Data", "Permanently delete stored history")}
                    </div>
                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {[
                        { label: "Clear Search History", key: "ak_recent_searches", confirm: clearSearchConfirm, setConfirm: setClearSearchConfirm },
                        { label: "Clear Chat History", key: "ak_chat_history", confirm: clearChatConfirm, setConfirm: setClearChatConfirm },
                      ].map(({ label, key, confirm, setConfirm }) => (
                        <div key={key}>
                          {!confirm ? (
                            <button type="button" onClick={() => setConfirm(true)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", cursor: "pointer", color: "#f87171", fontSize: "13px", fontWeight: 700, width: "100%", transition: "all 0.2s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}>
                              <Trash2 size={13} /> {label}
                            </button>
                          ) : (
                            <div style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                                <AlertTriangle size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />
                                <p style={{ margin: 0, color: "#fbbf24", fontSize: "13px", fontWeight: 700 }}>Are you sure? This cannot be undone.</p>
                              </div>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button type="button" onClick={() => setConfirm(false)} style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                                <button type="button" onClick={() => clearHistory(key, label)} style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "rgba(239,68,68,0.8)", border: "none", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Yes, Delete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: "11px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <AlertTriangle size={14} style={{ color: "#f87171", marginTop: "1px", flexShrink: 0 }} />
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.5 }}>Cleared data cannot be recovered. Export your data first if you want to keep a backup.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border-light)", textAlign: "center", flexShrink: 0 }}>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "11px", fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase" }}>AUTONOMOUS AI KNOWLEDGE WORKER</p>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes panelIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes fadeUp { from { transform: translateY(6px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      `}</style>
    </>
  );
}
