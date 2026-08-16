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
  Palette,
} from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

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

export default function UserProfile({
  username,
  onClose,
  onLogout,
}: UserProfileProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");

  const [activeTab, setActiveTab] = useState<"profile" | "appearance">("profile");

  // Appearance theme & accent state
  const [currentTheme, setCurrentTheme] = useState("dark");
  const [currentAccent, setCurrentAccent] = useState("cyan");
  const [customHex, setCustomHex] = useState("#22d3ee");
  const [currentFont, setCurrentFont] = useState("inter");
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [rippleId, setRippleId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const ACCENT_COLORS = [
    { id: "cyan", color: "#22d3ee", label: "Cyan" },
    { id: "purple", color: "#a855f7", label: "Purple" },
    { id: "emerald", color: "#10b981", label: "Emerald" },
    { id: "amber", color: "#f59e0b", label: "Amber" },
    { id: "rose", color: "#f43f5e", label: "Rose" },
  ];

  const FONT_OPTIONS = [
    { id: "plus-jakarta", label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif", hint: "Executive & modern tech" },
    { id: "manrope", label: "Manrope", family: "'Manrope', sans-serif", hint: "Swiss minimalist clarity" },
    { id: "inter", label: "Inter", family: "'Inter', sans-serif", hint: "Industry standard precision" },
    { id: "outfit", label: "Outfit", family: "'Outfit', sans-serif", hint: "Sleek & contemporary" },
    { id: "urbanist", label: "Urbanist", family: "'Urbanist', sans-serif", hint: "Sharp & sophisticated" },
    { id: "figtree", label: "Figtree", family: "'Figtree', sans-serif", hint: "Clean, balanced & friendly" },
  ];

  const AVATAR_EMOJIS = ["🤖","🚀","🧠","⚡","🎯","🦊","🌌","🔥","💎","🐉","🎭","🦋","🌙","⭐","🎪","🏆"];

  useEffect(() => {
    const savedTheme = localStorage.getItem("ak_theme") || "dark";
    const savedAccent = localStorage.getItem("ak_accent") || "cyan";
    const savedCustomHex = localStorage.getItem("ak_accent_custom_hex") || "#22d3ee";
    const savedFont = localStorage.getItem("ak_font") || "plus-jakarta";
    const savedEmoji = localStorage.getItem("ak_avatar_emoji") || "";
    setCurrentTheme(savedTheme);
    setCurrentAccent(savedAccent);
    setCustomHex(savedCustomHex);
    setCurrentFont(savedFont);
    setAvatarEmoji(savedEmoji);
    const activeColor = savedAccent === "custom"
      ? savedCustomHex
      : (ACCENT_COLORS.find((a) => a.id === savedAccent)?.color || ACCENT_COLORS[0].color);
    document.documentElement.style.setProperty("--accent-primary", activeColor);
    applyFont(savedFont);
  }, []);

  function applyFont(fontId: string) {
    const fontObj = FONT_OPTIONS.find((f) => f.id === fontId);
    if (!fontObj) return;
    document.documentElement.style.setProperty("--font-family", fontObj.family);
    document.body.style.fontFamily = fontObj.family;
    // Inject Google Fonts link if not present
    const linkId = `gf-${fontId}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      const name = fontObj.label.replace(/ /g, "+");
      link.href = `https://fonts.googleapis.com/css2?family=${name}:wght@400;500;600;700;800;900&display=swap`;
      document.head.appendChild(link);
    }
  }

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("ak_theme", themeId);
    document.documentElement.setAttribute("data-theme", themeId);
    const themeName = themeId === "oled" ? "OLED Black" : themeId === "light" ? "Light Elegance" : "Dark Glass";
    showToast(`Theme updated to ${themeName}! ✨`, "ok");
  };

  const handleAccentChange = (accentId: string) => {
    const accentObj = ACCENT_COLORS.find((a) => a.id === accentId);
    if (!accentObj) return;
    setRippleId(accentId);
    setTimeout(() => setRippleId(null), 600);
    setCurrentAccent(accentId);
    localStorage.setItem("ak_accent", accentId);
    document.documentElement.style.setProperty("--accent-primary", accentObj.color);
    showToast(`Accent updated to ${accentObj.label}! 🎨`, "ok");
  };

  const handleCustomAccentChange = (hex: string) => {
    setCustomHex(hex);
    setCurrentAccent("custom");
    localStorage.setItem("ak_accent", "custom");
    localStorage.setItem("ak_accent_custom_hex", hex);
    document.documentElement.style.setProperty("--accent-primary", hex);
    showToast(`Custom accent set to ${hex.toUpperCase()}! 🎨`, "ok");
  };

  const handleFontChange = (fontId: string) => {
    setCurrentFont(fontId);
    localStorage.setItem("ak_font", fontId);
    applyFont(fontId);
    const fontObj = FONT_OPTIONS.find((f) => f.id === fontId);
    showToast(`Font changed to ${fontObj?.label}! 🔤`, "ok");
  };

  const handleAvatarEmoji = (emoji: string) => {
    setAvatarEmoji(emoji);
    localStorage.setItem("ak_avatar_emoji", emoji);
    setShowEmojiPicker(false);
    showToast(`Avatar updated! ${emoji}`, "ok");
  };

  // AI settings state
  const [defaultModel, setDefaultModel] = useState("llama-70b");
  const [temperature, setTemperature] = useState(0.1);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(100);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [username]);

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
        body: JSON.stringify({
          default_model: defaultModel,
          temperature,
          system_prompt: systemPrompt,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap
        })
      });
      if (!res.ok) throw new Error();
      showToast("AI Settings updated successfully!", "ok");
    } catch {
      showToast("Failed to save AI Settings.", "err");
    } finally {
      setSettingsSaving(false);
    }
  }

  // ── Change Password state ─────────────────────────────────────────
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const sessionTime = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  )[0];
  const sessionDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isAdmin = username === "admin";
  const initials = (profile?.name || username)
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/auth/profile`,
        {
          credentials: "include"
        }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data);
      setEditName(data.name || "");
      setEditEmail(data.email || "");
      setEditMobile(data.mobile || "");
    } catch {
      // Still show UI, just no server data
      setProfile({ id: 0, username, name: "", email: "", mobile: "" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", editName);
      fd.append("email", editEmail);
      fd.append("mobile", editMobile);
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error();
      setProfile((p) =>
        p ? { ...p, name: editName, email: editEmail, mobile: editMobile } : p,
      );
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
    if (newPw.length < 8)
      return setPwError("New password must be at least 8 characters.");
    if (newPw !== confirmPw) return setPwError("New passwords do not match.");
    setPwSaving(true);
    try {
      const fd = new FormData();
      fd.append("old_password", oldPw);
      fd.append("new_password", newPw);
      const res = await fetch(`${API_BASE_URL}/auth/password`, {
        method: "PUT",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.detail || "Failed to change password.");
        return;
      }
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setShowPwForm(false);
      showToast("Password changed successfully! 🔒", "ok");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwSaving(false);
    }
  }

  const field = (
    label: string,
    value: string | undefined,
    color: string,
    icon: React.ReactNode,
    editVal: string,
    setEdit: (v: string) => void,
    placeholder: string,
  ) => (
    <div
      style={{
        padding: "20px 24px",
        borderBottom: "1px solid var(--border-light)",
        display: "flex",
        alignItems: editing ? "flex-start" : "center",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "12px",
          flexShrink: 0,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: editing ? "2px" : 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 5px",
            color: "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
        {editing ? (
          <input
            value={editVal}
            onChange={(e) => setEdit(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%",
              background: "var(--bg-surface)",
              border: `1px solid ${color}55`,
              borderRadius: "10px",
              padding: "10px 14px",
              color: "var(--text-primary)",
              fontSize: "16px",
              fontWeight: 500,
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = color)}
            onBlur={(e) => (e.target.style.borderColor = `${color}55`)}
          />
        ) : (
          <p
            style={{
              margin: 0,
              color: value ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: "17px",
              fontWeight: value ? 600 : 400,
              fontStyle: value ? "normal" : "italic",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value || "Not set"}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Dim backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          background: "var(--bg-sidebar)",
          borderLeft: "1px solid var(--border-medium)",
          boxShadow: "-40px 0 100px rgba(0,0,0,0.9)",
          animation: "panelIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        }}
      >
        {/* ════ STICKY HEADER ════ */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            background: "var(--bg-header)",
            backdropFilter: "blur(24px)",
            borderBottom: "1px solid var(--border-light)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "9px",
                background:
                  "linear-gradient(135deg,rgba(37,99,235,.25),rgba(13,148,136,.2))",
                border: "1px solid rgba(59,130,246,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={15} style={{ color: "#60a5fa" }} />
            </div>
            <span style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: "17px" }}>
              My Profile
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-surface)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "2.5px solid rgba(37,99,235,0.2)",
                borderTopColor: "#2563eb",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
        ) : (
          <>
            {/* ════ HERO SECTION ════ */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "48px 24px 36px",
                textAlign: "center",
                background: "linear-gradient(180deg, var(--bg-header) 0%, var(--bg-sidebar) 100%)",
                borderBottom: "1px solid var(--border-light)",
                flexShrink: 0,
              }}
            >
              {/* Aurora glow blobs behind avatar */}
              <div
                style={{
                  position: "absolute",
                  top: "0%",
                  left: "20%",
                  width: "240px",
                  height: "240px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)",
                  filter: "blur(40px)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "0%",
                  right: "15%",
                  width: "200px",
                  height: "200px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)",
                  filter: "blur(35px)",
                  pointerEvents: "none",
                }}
              />
              {/* Dot grid overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.08,
                  backgroundImage:
                    "radial-gradient(var(--text-primary) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  pointerEvents: "none",
                }}
              />

              {/* Avatar with animated ring + emoji picker */}
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: "-4px",
                    borderRadius: "28px",
                    background: `linear-gradient(135deg, var(--accent-primary, #22d3ee), #0d9488, var(--accent-primary, #22d3ee))`,
                    backgroundSize: "200% 200%",
                    animation: "gradientShift 3s ease infinite",
                    padding: "2px",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "88px",
                    height: "88px",
                    borderRadius: "24px",
                    background: avatarEmoji
                      ? "var(--bg-secondary)"
                      : "linear-gradient(145deg, #1d4ed8 0%, #0d9488 100%)",
                    border: avatarEmoji ? "2px solid var(--border-medium)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: avatarEmoji ? "44px" : "34px",
                    fontWeight: 900,
                    color: "white",
                    letterSpacing: "-1px",
                    boxShadow:
                      "0 16px 40px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                >
                  {initials}
                </div>
              </div>

              {/* Name */}
              <h2
                style={{
                  margin: "0 0 6px",
                  color: "var(--text-primary)",
                  fontSize: "24px",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                }}
              >
                {profile?.name || username}
              </h2>
              <p
                style={{
                  margin: "0 0 12px",
                  color: "var(--text-secondary)",
                  fontSize: "16px",
                  fontWeight: 500,
                }}
              >
                @{username}
              </p>

              {/* Avatar emoji picker trigger */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: "12px", padding: "4px 10px", borderRadius: "6px", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-primary, #22d3ee)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                ✏️ Change Avatar
              </button>
              {showEmojiPicker && (
                <div style={{ position: "absolute", top: "calc(100% - 60px)", left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: "16px", padding: "12px", boxShadow: "0 16px 48px rgba(0,0,0,0.6)", display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "6px", backdropFilter: "blur(20px)" }}>
                  <button type="button" onClick={() => handleAvatarEmoji("")} style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "6px", cursor: "pointer" }}>ABC</button>
                  {AVATAR_EMOJIS.map((em) => (
                    <button key={em} type="button" onClick={() => handleAvatarEmoji(em)} style={{ fontSize: "22px", background: avatarEmoji === em ? "color-mix(in srgb, var(--accent-primary, #22d3ee) 15%, transparent)" : "transparent", border: avatarEmoji === em ? "1px solid var(--accent-primary, #22d3ee)" : "1px solid transparent", borderRadius: "8px", cursor: "pointer", padding: "4px", transition: "all 0.15s" }}>{em}</button>
                  ))}
                </div>
              )}

              {/* Role badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 16px",
                  borderRadius: "999px",
                  background: isAdmin
                    ? "rgba(250,204,21,0.1)"
                    : "rgba(37,99,235,0.12)",
                  border: isAdmin
                    ? "1px solid rgba(250,204,21,0.3)"
                    : "1px solid rgba(37,99,235,0.3)",
                }}
              >
                <Shield
                  size={13}
                  style={{ color: isAdmin ? "#fbbf24" : "#60a5fa" }}
                />
                <span
                  style={{
                    color: isAdmin ? "#fde68a" : "#93c5fd",
                    fontSize: "14px",
                    fontWeight: 800,
                    letterSpacing: "0.5px",
                  }}
                >
                  {isAdmin ? "Administrator" : "Standard User"}
                </span>
              </div>

              {/* Stats Row */}
              <div
                style={{
                  display: "flex",
                  gap: "1px",
                  marginTop: "28px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: "1px solid var(--border-light)",
                }}
              >
                {[
                  {
                    label: "Account ID",
                    value: `#${String(profile?.id || 1).padStart(3, "0")}`,
                  },
                  { label: "Session", value: "Active" },
                  { label: "Role", value: isAdmin ? "Admin" : "User" },
                ].map(({ label, value }, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      padding: "14px 10px",
                      background: "var(--bg-secondary)",
                      textAlign: "center",
                      borderRight:
                        i < 2 ? "1px solid var(--border-light)" : "none",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 4px",
                        color: "var(--text-secondary)",
                        fontSize: "12px",
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: value === "Active" ? "#34d399" : "var(--text-primary)",
                        fontSize: "16px",
                        fontWeight: 800,
                      }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Swapper */}
            <div
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid var(--border-light)",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setActiveTab("profile")}
                style={{
                  flex: 1,
                  padding: "14px 10px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === "profile" ? "var(--accent-primary, #22d3ee)" : "transparent"}`,
                  color: activeTab === "profile" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                👤 Profile
              </button>
              <button
                onClick={() => setActiveTab("appearance")}
                style={{
                  flex: 1,
                  padding: "14px 10px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === "appearance" ? "var(--accent-primary, #22d3ee)" : "transparent"}`,
                  color: activeTab === "appearance" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                🎨 Appearance
              </button>

            </div>

            {/* ════ BODY ════ */}
            <div style={{ flex: 1, padding: "24px" }}>
              {activeTab === "appearance" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

                  {/* ── THEME MODE with animated preview cards ── */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "color-mix(in srgb, var(--accent-primary,#22d3ee) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary,#22d3ee) 25%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Palette size={16} style={{ color: "var(--accent-primary, #22d3ee)" }} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Theme Mode</h3>
                        <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>Live-preview your workspace theme</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                      {[
                        { id: "dark", label: "Dark Glass", icon: Moon, bg: "#0a0a14", bar: "#1a1a2e", accent: "#22d3ee" },
                        { id: "oled", label: "OLED Black", icon: Monitor, bg: "#000000", bar: "#0a0a0a", accent: "#22d3ee" },
                        { id: "light", label: "Light", icon: Sun, bg: "#f8fafc", bar: "#e2e8f0", accent: "#0891b2" },
                      ].map((t) => {
                        const Icon = t.icon;
                        const isSel = currentTheme === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleThemeChange(t.id)}
                            style={{
                              display: "flex", flexDirection: "column", gap: "8px",
                              padding: "10px", borderRadius: "14px", cursor: "pointer", textAlign: "left",
                              background: isSel ? "color-mix(in srgb, var(--accent-primary,#22d3ee) 10%, transparent)" : "var(--bg-secondary)",
                              border: `2px solid ${isSel ? "var(--accent-primary, #22d3ee)" : "var(--border-light)"}`,
                              transition: "all 0.22s ease",
                              transform: isSel ? "scale(1.03)" : "scale(1)",
                              boxShadow: isSel ? "0 4px 20px color-mix(in srgb, var(--accent-primary,#22d3ee) 20%, transparent)" : "none",
                            }}
                          >
                            {/* Mini UI thumbnail */}
                            <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: t.bg, height: "54px", position: "relative", flexShrink: 0 }}>
                              <div style={{ height: "12px", background: t.bar, display: "flex", alignItems: "center", padding: "0 6px", gap: "3px" }}>
                                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#ef4444", opacity: 0.8 }} />
                                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#f59e0b", opacity: 0.8 }} />
                                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#22c55e", opacity: 0.8 }} />
                                <div style={{ marginLeft: "auto", width: "20px", height: "4px", borderRadius: "2px", background: t.accent, opacity: 0.7 }} />
                              </div>
                              <div style={{ display: "flex", gap: "4px", padding: "4px 5px" }}>
                                <div style={{ width: "14px", borderRadius: "3px", background: t.bar, flexShrink: 0 }} />
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
                                  <div style={{ height: "5px", borderRadius: "2px", background: t.id === "light" ? "#94a3b8" : "rgba(255,255,255,0.15)" }} />
                                  <div style={{ height: "5px", borderRadius: "2px", background: t.id === "light" ? "#cbd5e1" : "rgba(255,255,255,0.08)", width: "70%" }} />
                                  <div style={{ height: "5px", borderRadius: "2px", background: t.accent, width: "40%", opacity: 0.8 }} />
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Icon size={12} style={{ color: isSel ? "var(--accent-primary,#22d3ee)" : "var(--text-muted)", flexShrink: 0 }} />
                              <span style={{ fontSize: "11px", fontWeight: 700, color: isSel ? "var(--accent-primary,#22d3ee)" : "var(--text-secondary)", lineHeight: 1.2 }}>{t.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── ACCENT COLOR with ripple + live preview strip ── */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Sparkles size={16} style={{ color: "#c084fc" }} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Accent Color</h3>
                        <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>Signature highlight across the entire app</p>
                      </div>
                    </div>

                    {/* Swatches with ripple */}
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      {ACCENT_COLORS.map((a) => {
                        const isSel = currentAccent === a.id;
                        const isRippling = rippleId === a.id;
                        return (
                          <div key={a.id} style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={() => handleAccentChange(a.id)}
                              title={a.label}
                              style={{
                                width: "42px", height: "42px", borderRadius: "13px",
                                background: a.color,
                                border: isSel ? "3px solid white" : "3px solid transparent",
                                boxShadow: isSel ? `0 0 0 2px ${a.color}, 0 6px 20px ${a.color}55` : `0 2px 8px ${a.color}33`,
                                cursor: "pointer", transition: "all 0.22s ease",
                                transform: isSel ? "scale(1.15)" : "scale(1)",
                                position: "relative", overflow: "hidden",
                              }}
                            >
                              {isRippling && (
                                <span style={{
                                  position: "absolute", inset: 0, borderRadius: "13px",
                                  background: "rgba(255,255,255,0.45)",
                                  animation: "ripplePulse 0.55s ease-out forwards",
                                }} />
                              )}
                            </button>
                            <span style={{ display: "block", textAlign: "center", fontSize: "9px", fontWeight: 700, color: isSel ? "var(--text-primary)" : "var(--text-muted)", marginTop: "4px", letterSpacing: "0.3px" }}>{a.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live Accent Preview Strip */}
                    <div style={{ marginTop: "14px", padding: "14px 16px", borderRadius: "14px", background: "var(--bg-secondary)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", flexShrink: 0 }}>Live Preview</span>
                      <button style={{ padding: "5px 14px", borderRadius: "8px", background: "var(--accent-primary, #22d3ee)", color: "#000", border: "none", fontWeight: 700, fontSize: "11px", cursor: "default" }}>Button</button>
                      <span style={{ padding: "3px 10px", borderRadius: "6px", background: "color-mix(in srgb, var(--accent-primary,#22d3ee) 15%, transparent)", color: "var(--accent-primary,#22d3ee)", fontSize: "11px", fontWeight: 700, border: "1px solid color-mix(in srgb, var(--accent-primary,#22d3ee) 30%, transparent)" }}>Badge</span>
                      <div style={{ flex: 1, minWidth: "80px", height: "5px", borderRadius: "99px", background: "var(--bg-surface)", overflow: "hidden" }}>
                        <div style={{ width: "65%", height: "100%", borderRadius: "99px", background: "var(--accent-primary, #22d3ee)" }} />
                      </div>
                      <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "var(--accent-primary, #22d3ee)", boxShadow: "0 0 8px var(--accent-primary, #22d3ee)" }} />
                    </div>

                    {/* Custom Color Input */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
                      <label htmlFor="custom-accent-color-picker" style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", flex: 1, cursor: "pointer" }}>Custom Color:</label>
                      <input
                        id="custom-accent-color-picker"
                        type="color"
                        value={customHex}
                        onChange={(e) => handleCustomAccentChange(e.target.value)}
                        style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", cursor: "pointer", background: "transparent" }}
                        title="Pick any custom color"
                      />
                      <input
                        type="text"
                        value={customHex}
                        onChange={(e) => { setCustomHex(e.target.value); if (/^#[0-9A-F]{6}$/i.test(e.target.value)) handleCustomAccentChange(e.target.value); }}
                        placeholder="#22d3ee"
                        style={{ width: "85px", padding: "4px 8px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--text-primary)", fontSize: "12px", fontFamily: "monospace", textTransform: "uppercase" }}
                      />
                    </div>
                  </div>

                  {/* ── FONT STYLE SELECTOR ── */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "14px", color: "#fbbf24" }}>Aa</div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Font Style</h3>
                        <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>Global typeface for the entire workspace</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {FONT_OPTIONS.map((f) => {
                        const isSel = currentFont === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleFontChange(f.id)}
                            style={{
                              padding: "12px 14px", borderRadius: "12px", textAlign: "left", cursor: "pointer",
                              background: isSel ? "color-mix(in srgb, var(--accent-primary,#22d3ee) 10%, transparent)" : "var(--bg-secondary)",
                              border: `1px solid ${isSel ? "var(--accent-primary, #22d3ee)" : "var(--border-light)"}`,
                              transition: "all 0.2s ease",
                            }}
                          >
                            <p style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 700, color: isSel ? "var(--accent-primary,#22d3ee)" : "var(--text-primary)", fontFamily: f.family }}>{f.label}</p>
                            <p style={{ margin: 0, fontSize: "10px", color: "var(--text-muted)" }}>{f.hint}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <>
                  {/* Session card */}
                  <div
                    style={{
                      borderRadius: "16px",
                      overflow: "hidden",
                      border: "1px solid var(--border-light)",
                      marginBottom: "20px",
                    }}
                  >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "18px 20px",
                    background: "var(--bg-secondary)",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "rgba(37,99,235,0.12)",
                      border: "1px solid rgba(37,99,235,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={17} style={{ color: "#60a5fa" }} />
                  </div>
                  <div>
                    <p
                      style={{
                        margin: "0 0 3px",
                        color: "var(--text-primary)",
                        fontSize: "16px",
                        fontWeight: 700,
                      }}
                    >
                      {sessionDate}
                    </p>
                    <p
                      style={{ margin: 0, color: "var(--text-secondary)", fontSize: "15px" }}
                    >
                      Logged in at {sessionTime}
                    </p>
                  </div>
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "6px 12px",
                      borderRadius: "999px",
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.2)",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#10b981",
                        boxShadow: "0 0 6px #10b981",
                        animation: "pulse 2s infinite",
                      }}
                    />
                    <span
                      style={{
                        color: "#34d399",
                        fontSize: "14px",
                        fontWeight: 700,
                      }}
                    >
                      Live
                    </span>
                  </div>
                </div>
              </div>

              {/* Toast */}
              {toast && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 18px",
                    borderRadius: "13px",
                    marginBottom: "20px",
                    background:
                      toast.type === "ok"
                        ? "rgba(16,185,129,0.1)"
                        : "rgba(239,68,68,0.1)",
                    border: `1px solid ${toast.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                    animation: "fadeUp 0.3s ease",
                  }}
                >
                  <CheckCircle
                    size={16}
                    style={{
                      color: toast.type === "ok" ? "#34d399" : "#f87171",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: toast.type === "ok" ? "#34d399" : "#f87171",
                      fontSize: "16px",
                      fontWeight: 600,
                    }}
                  >
                    {toast.msg}
                  </span>
                </div>
              )}

              {/* Account details */}
              <div
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid var(--border-light)",
                  marginBottom: "20px",
                }}
              >
                {/* Toolbar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "var(--bg-secondary)",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Sparkles size={13} style={{ color: "#60a5fa" }} />
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: 700,
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      Account Details
                    </span>
                  </div>
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 14px",
                        borderRadius: "9px",
                        background: "rgba(37,99,235,0.12)",
                        border: "1px solid rgba(37,99,235,0.25)",
                        color: "#60a5fa",
                        fontSize: "15px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => setEditing(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "7px 12px",
                          borderRadius: "9px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#64748b",
                          fontSize: "15px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <X size={13} /> Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "7px 16px",
                          borderRadius: "9px",
                          background: "linear-gradient(135deg,#2563eb,#0d9488)",
                          border: "none",
                          color: "white",
                          fontSize: "15px",
                          fontWeight: 700,
                          cursor: saving ? "wait" : "pointer",
                          boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
                        }}
                      >
                        <Save size={13} /> {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Username (locked) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "20px 24px",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "rgba(234,179,8,0.12)",
                      border: "1px solid rgba(234,179,8,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <KeyRound size={16} style={{ color: "#eab308" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: "0 0 5px",
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: 700,
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      Username
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--text-primary)",
                        fontSize: "17px",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      @{username}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "rgba(234,179,8,0.1)",
                      border: "1px solid rgba(234,179,8,0.25)",
                      color: "#f59e0b",
                      flexShrink: 0,
                    }}
                  >
                    LOCKED
                  </span>
                </div>

                {field(
                  "Full Name",
                  profile?.name,
                  "#3b82f6",
                  <User size={16} style={{ color: "#3b82f6" }} />,
                  editName,
                  setEditName,
                  "Your full name",
                )}
                {field(
                  "Email Address",
                  profile?.email,
                  "#2dd4bf",
                  <Mail size={16} style={{ color: "#2dd4bf" }} />,
                  editEmail,
                  setEditEmail,
                  "your@email.com",
                )}
                {field(
                  "Mobile Number",
                  profile?.mobile,
                  "#a78bfa",
                  <Phone size={16} style={{ color: "#a78bfa" }} />,
                  editMobile,
                  setEditMobile,
                  "+1 234 567 8900",
                )}
              </div>

              {/* ── Change Password Card ────────────────────────────────── */}
              <div
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid var(--border-light)",
                  marginBottom: "20px",
                }}
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPwForm((v) => !v);
                    setPwError("");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "var(--bg-secondary)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        background: "rgba(34,211,238,0.12)",
                        border: "1px solid rgba(34,211,238,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Lock size={14} style={{ color: "#22d3ee" }} />
                    </div>
                    <span
                      style={{
                        color: "#e2e8f0",
                        fontSize: "16px",
                        fontWeight: 700,
                      }}
                    >
                      Change Password
                    </span>
                  </div>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "15px",
                      transform: showPwForm ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}
                  >
                    ▾
                  </span>
                </button>

                {/* Collapsible Form */}
                {showPwForm && (
                  <div
                    style={{
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      borderTop: "1px solid var(--border-light)",
                    }}
                  >
                    {/* Current Password */}
                    <div>
                      <p
                        style={{
                          margin: "0 0 6px",
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                          fontWeight: 700,
                          letterSpacing: "1.2px",
                          textTransform: "uppercase",
                        }}
                      >
                        Current Password
                      </p>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showOld ? "text" : "password"}
                          value={oldPw}
                          onChange={(e) => setOldPw(e.target.value)}
                          placeholder="Enter current password"
                          style={{
                            width: "100%",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "10px",
                            padding: "10px 42px 10px 14px",
                            color: "var(--text-primary)",
                            fontSize: "16px",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                          onFocus={(e) =>
                            (e.target.style.borderColor =
                              "rgba(34,211,238,0.6)")
                          }
                          onBlur={(e) =>
                            (e.target.style.borderColor =
                              "var(--border-light)")
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowOld((v) => !v)}
                          style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-secondary)",
                            padding: 0,
                          }}
                        >
                          {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <p
                        style={{
                          margin: "0 0 6px",
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                          fontWeight: 700,
                          letterSpacing: "1.2px",
                          textTransform: "uppercase",
                        }}
                      >
                        New Password
                      </p>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showNew ? "text" : "password"}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="Min. 4 characters"
                          style={{
                            width: "100%",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "10px",
                            padding: "10px 42px 10px 14px",
                            color: "var(--text-primary)",
                            fontSize: "16px",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                          onFocus={(e) =>
                            (e.target.style.borderColor =
                              "rgba(34,211,238,0.6)")
                          }
                          onBlur={(e) =>
                            (e.target.style.borderColor =
                              "var(--border-light)")
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-secondary)",
                            padding: 0,
                          }}
                        >
                          {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <p
                        style={{
                          margin: "0 0 6px",
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                          fontWeight: 700,
                          letterSpacing: "1.2px",
                          textTransform: "uppercase",
                        }}
                      >
                        Confirm New Password
                      </p>
                      <input
                        type="password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Repeat new password"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleChangePassword()
                        }
                        style={{
                          width: "100%",
                          background: "var(--bg-surface)",
                          border: `1px solid ${confirmPw && confirmPw !== newPw ? "rgba(239,68,68,0.5)" : "var(--border-light)"}`,
                          borderRadius: "10px",
                          padding: "10px 14px",
                          color: "var(--text-primary)",
                          fontSize: "16px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) =>
                          (e.target.style.borderColor =
                            confirmPw !== newPw
                              ? "rgba(239,68,68,0.6)"
                              : "rgba(34,211,238,0.6)")
                        }
                        onBlur={(e) =>
                          (e.target.style.borderColor =
                            confirmPw && confirmPw !== newPw
                              ? "rgba(239,68,68,0.5)"
                              : "var(--border-light)")
                        }
                      />
                      {confirmPw && confirmPw !== newPw && (
                        <p
                          style={{
                            margin: "5px 0 0",
                            color: "#f87171",
                            fontSize: "14px",
                          }}
                        >
                          Passwords do not match
                        </p>
                      )}
                    </div>

                    {/* Error message */}
                    {pwError && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.25)",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            color: "#f87171",
                            fontSize: "15px",
                            fontWeight: 600,
                          }}
                        >
                          ⚠ {pwError}
                        </p>
                      </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPwForm(false);
                          setOldPw("");
                          setNewPw("");
                          setConfirmPw("");
                          setPwError("");
                        }}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: "10px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-light)",
                          color: "var(--text-secondary)",
                          fontSize: "15px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={pwSaving}
                        style={{
                          flex: 2,
                          padding: "10px",
                          borderRadius: "10px",
                          background:
                            "linear-gradient(135deg, #0891b2, #22d3ee)",
                          border: "none",
                          color: "white",
                          fontSize: "15px",
                          fontWeight: 700,
                          cursor: pwSaving ? "wait" : "pointer",
                          boxShadow: "0 4px 12px rgba(34,211,238,0.35)",
                        }}
                      >
                        {pwSaving ? "Changing…" : "🔒 Change Password"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ⌨️ Keyboard Shortcuts Reference */}
              <div style={{ borderRadius: "16px", border: "1px solid var(--border-light)", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{ padding: "14px 20px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "color-mix(in srgb, var(--accent-primary,#22d3ee) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary,#22d3ee) 25%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>⌨️</div>
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Keyboard Shortcuts</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>Power-user hotkeys for this workspace</p>
                  </div>
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {[
                    { keys: ["Ctrl", "K"], label: "Open Command Palette" },
                    { keys: ["Esc"], label: "Close panels & modals" },
                    { keys: ["Ctrl", "/"], label: "Focus chat input" },
                    { keys: ["Ctrl", "Enter"], label: "Submit message" },
                    { keys: ["Ctrl", "Shift", "N"], label: "Start new chat" },
                    { keys: ["Ctrl", "Shift", "F"], label: "Open File Workspace" },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "10px", background: i % 2 === 0 ? "var(--bg-secondary)" : "transparent" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{s.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {s.keys.map((k, j) => (
                          <span key={j} style={{ padding: "2px 7px", borderRadius: "5px", background: "var(--bg-surface)", border: "1px solid var(--border-medium)", fontSize: "11px", fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>{k}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign Out */}
              <button
                onClick={onLogout}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "20px 22px",
                  borderRadius: "16px",
                  background: "rgba(239,68,68,0.07)",
                  border: "1px solid rgba(239,68,68,0.14)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.13)";
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.28)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.07)";
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.14)";
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "13px",
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <LogOut size={18} style={{ color: "#f87171" }} />
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 3px",
                      color: "#f87171",
                      fontSize: "17px",
                      fontWeight: 800,
                    }}
                  >
                    Sign Out
                  </p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "15px" }}>
                    End your current session securely
                  </p>
                </div>
              </button>
            </>
          )}
        </div>

            {/* Footer */}
            <div
              style={{
                padding: "18px 24px",
                borderTop: "1px solid var(--border-light)",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                }}
              >
                AUTONOMOUS AI KNOWLEDGE WORKER
              </p>
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
        @keyframes ripplePulse { 0% { opacity: 0.8; transform: scale(0.6); } 100% { opacity: 0; transform: scale(2.2); } }
      `}</style>
    </>
  );
}
