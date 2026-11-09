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
  Camera,
  Upload,
  Trash2,
  Crop,
  Volume2,
  VolumeX,
  Compass,
  RotateCcw,
  Check,
  Laptop,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from "../config";
import PhotoCropperModal from "./PhotoCropperModal";

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
  avatar?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropperRawImage, setCropperRawImage] = useState<string | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const handleOpenAdjuster = () => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(`ak_avatar_raw_${username}`);
      if (raw) {
        setCropperRawImage(raw);
        return;
      }
    }
    if (profile?.avatar) {
      setCropperRawImage(profile.avatar);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please upload an image file (PNG, JPG, WebP).", "err");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      showToast("Image size must be under 12MB.", "err");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`ak_avatar_raw_${username}`, src);
        }
        setCropperRawImage(src);
      }
    };
    reader.onerror = () => {
      showToast("Failed to read image file.", "err");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveAvatar = (dataUrl: string) => {
    setUploadingAvatar(true);
    setProfile((prev) => (prev ? { ...prev, avatar: dataUrl } : prev));
    if (typeof window !== "undefined") {
      localStorage.setItem(`ak_avatar_${username}`, dataUrl);
      window.dispatchEvent(
        new CustomEvent("ak-avatar-updated", { detail: { avatar: dataUrl } })
      );
    }

    fetch(`${API_BASE_URL}/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ avatar: dataUrl }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        showToast("Profile photo updated! 📸", "ok");
      })
      .catch(() => {
        showToast("Photo saved locally. Server sync pending.", "ok");
      })
      .finally(() => {
        setUploadingAvatar(false);
      });
  };

  const handleRemoveAvatar = () => {
    setProfile((prev) => (prev ? { ...prev, avatar: "" } : prev));
    if (typeof window !== "undefined") {
      localStorage.removeItem(`ak_avatar_${username}`);
      localStorage.removeItem(`ak_avatar_raw_${username}`);
      window.dispatchEvent(
        new CustomEvent("ak-avatar-updated", { detail: { avatar: "" } })
      );
    }
    fetch(`${API_BASE_URL}/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ avatar: "" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        showToast("Profile photo removed.", "ok");
      })
      .catch(() => {
        showToast("Photo removed locally.", "ok");
      });
  };

  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "appearance">("profile");

  // Appearance theme & accent state
  const [currentTheme, setCurrentTheme] = useState("dark");
  const [currentAccent, setCurrentAccent] = useState("cyan");
  const [customHex, setCustomHex] = useState("#22d3ee");
  const [currentFont, setCurrentFont] = useState("inter");
  const [rippleId, setRippleId] = useState<string | null>(null);

  const ACCENT_COLORS = [
    { id: "cyan", color: "#22d3ee", label: "Cyan" },
    { id: "purple", color: "#a855f7", label: "Purple" },
    { id: "emerald", color: "#10b981", label: "Emerald" },
    { id: "amber", color: "#f59e0b", label: "Amber" },
    { id: "rose", color: "#f43f5e", label: "Rose" },
  ];

  const FONT_OPTIONS = [
    {
      id: "plus-jakarta",
      label: "Plus Jakarta Sans",
      family: "'Plus Jakarta Sans', sans-serif",
      hint: "Executive & modern tech",
    },
    {
      id: "manrope",
      label: "Manrope",
      family: "'Manrope', sans-serif",
      hint: "Swiss minimalist clarity",
    },
    {
      id: "inter",
      label: "Inter",
      family: "'Inter', sans-serif",
      hint: "Industry standard precision",
    },
    {
      id: "outfit",
      label: "Outfit",
      family: "'Outfit', sans-serif",
      hint: "Sleek & contemporary",
    },
    {
      id: "urbanist",
      label: "Urbanist",
      family: "'Urbanist', sans-serif",
      hint: "Sharp & sophisticated",
    },
    {
      id: "figtree",
      label: "Figtree",
      family: "'Figtree', sans-serif",
      hint: "Clean, balanced & friendly",
    },
  ];

  useEffect(() => {
    const savedTheme = localStorage.getItem("ak_theme") || "dark";
    const savedAccent = localStorage.getItem("ak_accent") || "cyan";
    const savedCustomHex =
      localStorage.getItem("ak_accent_custom_hex") || "#22d3ee";
    const savedFont = localStorage.getItem("ak_font") || "plus-jakarta";
    setCurrentTheme(savedTheme);
    setCurrentAccent(savedAccent);
    setCustomHex(savedCustomHex);
    setCurrentFont(savedFont);
    const activeColor =
      savedAccent === "custom"
        ? savedCustomHex
        : ACCENT_COLORS.find((a) => a.id === savedAccent)?.color ||
          ACCENT_COLORS[0].color;
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
    const themeName =
      themeId === "oled"
        ? "OLED Black"
        : themeId === "light"
          ? "Light Elegance"
          : "Dark Glass";
    showToast(`Theme updated to ${themeName}! ✨`, "ok");
  };

  const handleAccentChange = (accentId: string) => {
    const accentObj = ACCENT_COLORS.find((a) => a.id === accentId);
    if (!accentObj) return;
    setRippleId(accentId);
    setTimeout(() => setRippleId(null), 600);
    setCurrentAccent(accentId);
    localStorage.setItem("ak_accent", accentId);
    document.documentElement.style.setProperty(
      "--accent-primary",
      accentObj.color,
    );
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
      const res = await fetch(`${API_BASE_URL}/settings/`, {
        credentials: "include",
      });
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
          chunk_overlap: chunkOverlap,
        }),
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

    // ── PREFERENCES STATE ──
  const [startingTab, setStartingTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const userKey = username ? localStorage.getItem(`ak_default_starting_tab_${username}`) : null;
      return userKey || localStorage.getItem("ak_default_starting_tab") || "news";
    }
    return "news";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userKey = username ? localStorage.getItem(`ak_default_starting_tab_${username}`) : null;
      const saved = userKey || localStorage.getItem("ak_default_starting_tab");
      if (saved) {
        setStartingTab(saved);
      }
    }
  }, [username]);

  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ak_time_format") as "12h" | "24h") || "12h";
    }
    return "12h";
  });

  const [dateFormat, setDateFormat] = useState<"dmy" | "mdy">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ak_date_format") as "dmy" | "mdy") || "dmy";
    }
    return "dmy";
  });

  const [soundEffects, setSoundEffects] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ak_sound_effects") !== "false";
    }
    return true;
  });

  const [deviceInfo, setDeviceInfo] = useState({
    os: "Windows",
    browser: "Chrome",
    type: "Desktop",
  });

  const [loggingOutOthers, setLoggingOutOthers] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent;
      let os = "Desktop";
      if (ua.includes("Windows")) os = "Windows";
      else if (ua.includes("Mac")) os = "macOS";
      else if (ua.includes("Linux")) os = "Linux";
      else if (ua.includes("Android")) os = "Android";
      else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

      let browser = "Browser";
      if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
      else if (ua.includes("Edg")) browser = "Edge";
      else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
      else if (ua.includes("Firefox")) browser = "Firefox";

      setDeviceInfo({ os, browser, type: "Desktop" });
    }
  }, []);

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  };

  const getFormattedPreview = () => {
    const now = new Date();
    let timeStr = "";
    if (timeFormat === "24h") {
      timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    } else {
      timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    let dateStr = "";
    if (dateFormat === "mdy") {
      dateStr = now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    } else {
      dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return `${dateStr} · ${timeStr}`;
  };

  const handleResetDefaults = () => {
    setStartingTab("news");
    localStorage.setItem("ak_default_starting_tab", "news");
    if (username) {
      localStorage.setItem(`ak_default_starting_tab_${username}`, "news");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ak-starting-tab-changed", { detail: { startingTab: "news" } })
      );
    }

    setTimeFormat("12h");
    localStorage.setItem("ak_time_format", "12h");
    setDateFormat("dmy");
    localStorage.setItem("ak_date_format", "dmy");

    setSoundEffects(true);
    localStorage.setItem("ak_sound_effects", "true");

    handleThemeChange("dark");
    handleAccentChange("cyan");
    handleFontChange("inter");

    window.dispatchEvent(new CustomEvent("ak-datetime-format-changed"));
    showToast("✨ All preferences reset to factory defaults!", "ok");
  };

  const handleLogOutOtherDevices = () => {
    setLoggingOutOthers(true);
    setTimeout(() => {
      setLoggingOutOthers(false);
      showToast("Logged out of all other active sessions! 🔒", "ok");
    }, 750);
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
      });

      if (res.ok || res.status === 404) {
        showToast("Account deleted successfully.", "ok");
      } else {
        showToast("Local account data purged.", "ok");
      }
    } catch {
      showToast("Account data cleared.", "ok");
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("ak_token");
        localStorage.removeItem("ak_session");
        localStorage.removeItem(`ak_avatar_${username}`);
        localStorage.removeItem(`ak_avatar_raw_${username}`);
      }
      onLogout();
    }
  };

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
  const initials = (profile?.name || username || "U")
    .split(" ")
    .map((w: string) => w[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    fetchProfile();
  }, [username]);

    const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "X-Requested-With": "XMLHttpRequest",
      "X-AKW-CSRF": "1",
    };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("ak_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  };

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data);
      setEditName(data.name || "");
      setEditEmail(data.email || "");
      setEditMobile(data.mobile || "");
      if (data.avatar) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`ak_avatar_${username}`, data.avatar);
          window.dispatchEvent(
            new CustomEvent("ak-avatar-updated", { detail: { avatar: data.avatar } })
          );
        }
      } else if (typeof window !== "undefined") {
        const localAvatar = localStorage.getItem(`ak_avatar_${username}`);
        if (localAvatar) {
          setProfile((prev) => (prev ? { ...prev, avatar: localAvatar } : prev));
        }
      }
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
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          mobile: editMobile.trim(),
        }),
      });
      if (!res.ok) {
        let errMsg = "Save failed. Please try again.";
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
        } catch {}
        showToast(errMsg, "err");
        return;
      }
      const data = await res.json().catch(() => null);
      setProfile((p) =>
        p ? {
          ...p,
          name: data?.name ?? editName,
          email: data?.email ?? editEmail,
          mobile: data?.mobile ?? editMobile,
        } : p,
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
      return setPwError("New password must be at least 8 characters long.");
    if (newPw.length > 128)
      return setPwError("New password must be at most 128 characters long.");
    if (!/[A-Z]/.test(newPw))
      return setPwError("New password must contain at least one uppercase letter (A-Z).");
    if (!/[a-z]/.test(newPw))
      return setPwError("New password must contain at least one lowercase letter (a-z).");
    if (!/[0-9]/.test(newPw))
      return setPwError("New password must contain at least one number (0-9).");
    if (!/[^a-zA-Z0-9]/.test(newPw))
      return setPwError("New password must contain at least one special character (!@#$%...).");
    if (newPw !== confirmPw) return setPwError("New passwords do not match.");
    setPwSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          current_password: oldPw,
          new_password: newPw,
          old_password: oldPw,
          currentPassword: oldPw,
          newPassword: newPw,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(data.message || data.detail || "Failed to change password.");
        return;
      }
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setShowPwForm(false);
      showToast("Password changed! 🔒 Signing you out for security…", "ok");
      setTimeout(() => {
        onLogout();
      }, 2200);
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
            <span
              style={{
                color: "var(--text-primary)",
                fontWeight: 800,
                fontSize: "17px",
              }}
            >
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
                background:
                  "linear-gradient(180deg, var(--bg-header) 0%, var(--bg-sidebar) 100%)",
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

              {/* Avatar container */}
              <div
                style={{
                  position: "relative",
                  marginBottom: "16px",
                  display: "inline-block",
                }}
              >
                {/* Glow ring */}
                <div
                  style={{
                    position: "absolute",
                    inset: "-4px",
                    borderRadius: "28px",
                    background:
                      "linear-gradient(135deg, var(--accent-primary, #22d3ee) 0%, #3b82f6 100%)",
                    opacity: 0.5,
                    filter: "blur(10px)",
                  }}
                />

                <div
                  onClick={() => {
                    if (profile?.avatar) {
                      setShowPhotoViewer(true);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  title={profile?.avatar ? "Click to view & edit photo" : "Click to upload photo"}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "88px",
                    height: "88px",
                    borderRadius: "24px",
                    background: profile?.avatar
                      ? "var(--bg-secondary)"
                      : "linear-gradient(145deg, #1d4ed8 0%, #0d9488 100%)",
                    border: "2px solid var(--border-medium)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "34px",
                    fontWeight: 900,
                    color: "white",
                    letterSpacing: "-1px",
                    overflow: "hidden",
                    cursor: "pointer",
                    boxShadow:
                      "0 16px 40px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                >
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name || username}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>

                {/* Floating camera action badge on avatar corner */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (profile?.avatar) {
                      setShowPhotoViewer(true);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  title={profile?.avatar ? "View & edit photo" : "Upload photo"}
                  disabled={uploadingAvatar}
                  style={{
                    position: "absolute",
                    bottom: "-4px",
                    right: "-4px",
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: "var(--accent-primary, #22d3ee)",
                    color: "#0a0e17",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--bg-card, #131722)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    cursor: uploadingAvatar ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    zIndex: 3,
                  }}
                >
                  <Camera size={14} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                />
              </div>

              {/* Name */}
              <h2
                style={{
                  margin: "0 0 4px",
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
                  margin: "0 0 10px",
                  color: "var(--text-secondary)",
                  fontSize: "15px",
                  fontWeight: 500,
                }}
              >
                @{username}
              </p>

              {/* Clean, neat photo action bar */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: "14px",
                }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  style={{
                    background: "var(--bg-secondary, rgba(255,255,255,0.05))",
                    border: "1px solid var(--border-medium, rgba(255,255,255,0.12))",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary, #f1f5f9)",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-primary, #22d3ee)";
                    e.currentTarget.style.color = "var(--accent-primary, #22d3ee)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-medium, rgba(255,255,255,0.12))";
                    e.currentTarget.style.color = "var(--text-primary, #f1f5f9)";
                  }}
                >
                  <Upload size={12} />
                  {uploadingAvatar ? "Processing…" : profile?.avatar ? "Change Photo" : "Upload Photo"}
                </button>

                {profile?.avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#ef4444",
                      padding: "5px 12px",
                      borderRadius: "8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                      e.currentTarget.style.borderColor = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                    }}
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                )}
              </div>

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
                        color:
                          value === "Active"
                            ? "#34d399"
                            : "var(--text-primary)",
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
                type="button"
                onClick={() => setActiveTab("profile")}
                style={{
                  flex: 1,
                  padding: "14px 6px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === "profile" ? "var(--accent-primary, #22d3ee)" : "transparent"}`,
                  color:
                    activeTab === "profile"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>👤</span>
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preferences")}
                style={{
                  flex: 1,
                  padding: "14px 6px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === "preferences" ? "var(--accent-primary, #22d3ee)" : "transparent"}`,
                  color:
                    activeTab === "preferences"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>⚙️</span>
                <span>Preferences</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                style={{
                  flex: 1,
                  padding: "14px 6px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === "appearance" ? "var(--accent-primary, #22d3ee)" : "transparent"}`,
                  color:
                    activeTab === "appearance"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>🎨</span>
                <span>Appearance</span>
              </button>
            </div>

            {/* ════ BODY ════ */}
            <div style={{ flex: 1, padding: "24px" }}>
              {activeTab === "appearance" ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                  }}
                >
                  {/* ── THEME MODE with animated preview cards ── */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "14px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "10px",
                          background:
                            "color-mix(in srgb, var(--accent-primary,#22d3ee) 12%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--accent-primary,#22d3ee) 25%, transparent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Palette
                          size={16}
                          style={{ color: "var(--accent-primary, #22d3ee)" }}
                        />
                      </div>
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          Theme Mode
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "11px",
                            color: "var(--text-muted)",
                          }}
                        >
                          Live-preview your workspace theme
                        </p>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "10px",
                      }}
                    >
                      {[
                        {
                          id: "dark",
                          label: "Dark Glass",
                          icon: Moon,
                          bg: "#0a0a14",
                          bar: "#1a1a2e",
                          accent: "#22d3ee",
                        },
                        {
                          id: "oled",
                          label: "OLED Black",
                          icon: Monitor,
                          bg: "#000000",
                          bar: "#0a0a0a",
                          accent: "#22d3ee",
                        },
                        {
                          id: "light",
                          label: "Light",
                          icon: Sun,
                          bg: "#f8fafc",
                          bar: "#e2e8f0",
                          accent: "#0891b2",
                        },
                      ].map((t) => {
                        const Icon = t.icon;
                        const isSel = currentTheme === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleThemeChange(t.id)}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              padding: "10px",
                              borderRadius: "14px",
                              cursor: "pointer",
                              textAlign: "left",
                              background: isSel
                                ? "color-mix(in srgb, var(--accent-primary,#22d3ee) 10%, transparent)"
                                : "var(--bg-secondary)",
                              border: `2px solid ${isSel ? "var(--accent-primary, #22d3ee)" : "var(--border-light)"}`,
                              transition: "all 0.22s ease",
                              transform: isSel ? "scale(1.03)" : "scale(1)",
                              boxShadow: isSel
                                ? "0 4px 20px color-mix(in srgb, var(--accent-primary,#22d3ee) 20%, transparent)"
                                : "none",
                            }}
                          >
                            {/* Mini UI thumbnail */}
                            <div
                              style={{
                                borderRadius: "8px",
                                overflow: "hidden",
                                border: "1px solid rgba(255,255,255,0.08)",
                                background: t.bg,
                                height: "54px",
                                position: "relative",
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  height: "12px",
                                  background: t.bar,
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "0 6px",
                                  gap: "3px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "4px",
                                    height: "4px",
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                    opacity: 0.8,
                                  }}
                                />
                                <div
                                  style={{
                                    width: "4px",
                                    height: "4px",
                                    borderRadius: "50%",
                                    background: "#f59e0b",
                                    opacity: 0.8,
                                  }}
                                />
                                <div
                                  style={{
                                    width: "4px",
                                    height: "4px",
                                    borderRadius: "50%",
                                    background: "#22c55e",
                                    opacity: 0.8,
                                  }}
                                />
                                <div
                                  style={{
                                    marginLeft: "auto",
                                    width: "20px",
                                    height: "4px",
                                    borderRadius: "2px",
                                    background: t.accent,
                                    opacity: 0.7,
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "4px",
                                  padding: "4px 5px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "14px",
                                    borderRadius: "3px",
                                    background: t.bar,
                                    flexShrink: 0,
                                  }}
                                />
                                <div
                                  style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "3px",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "5px",
                                      borderRadius: "2px",
                                      background:
                                        t.id === "light"
                                          ? "#94a3b8"
                                          : "rgba(255,255,255,0.15)",
                                    }}
                                  />
                                  <div
                                    style={{
                                      height: "5px",
                                      borderRadius: "2px",
                                      background:
                                        t.id === "light"
                                          ? "#cbd5e1"
                                          : "rgba(255,255,255,0.08)",
                                      width: "70%",
                                    }}
                                  />
                                  <div
                                    style={{
                                      height: "5px",
                                      borderRadius: "2px",
                                      background: t.accent,
                                      width: "40%",
                                      opacity: 0.8,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Icon
                                size={12}
                                style={{
                                  color: isSel
                                    ? "var(--accent-primary,#22d3ee)"
                                    : "var(--text-muted)",
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: isSel
                                    ? "var(--accent-primary,#22d3ee)"
                                    : "var(--text-secondary)",
                                  lineHeight: 1.2,
                                }}
                              >
                                {t.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── ACCENT COLOR with ripple + live preview strip ── */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "14px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "10px",
                          background: "rgba(168,85,247,0.1)",
                          border: "1px solid rgba(168,85,247,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Sparkles size={16} style={{ color: "#c084fc" }} />
                      </div>
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          Accent Color
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "11px",
                            color: "var(--text-muted)",
                          }}
                        >
                          Signature highlight across the entire app
                        </p>
                      </div>
                    </div>

                    {/* Swatches with ripple */}
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
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
                                width: "42px",
                                height: "42px",
                                borderRadius: "13px",
                                background: a.color,
                                border: isSel
                                  ? "3px solid white"
                                  : "3px solid transparent",
                                boxShadow: isSel
                                  ? `0 0 0 2px ${a.color}, 0 6px 20px ${a.color}55`
                                  : `0 2px 8px ${a.color}33`,
                                cursor: "pointer",
                                transition: "all 0.22s ease",
                                transform: isSel ? "scale(1.15)" : "scale(1)",
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              {isRippling && (
                                <span
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: "13px",
                                    background: "rgba(255,255,255,0.45)",
                                    animation:
                                      "ripplePulse 0.55s ease-out forwards",
                                  }}
                                />
                              )}
                            </button>
                            <span
                              style={{
                                display: "block",
                                textAlign: "center",
                                fontSize: "9px",
                                fontWeight: 700,
                                color: isSel
                                  ? "var(--text-primary)"
                                  : "var(--text-muted)",
                                marginTop: "4px",
                                letterSpacing: "0.3px",
                              }}
                            >
                              {a.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live Accent Preview Strip */}
                    <div
                      style={{
                        marginTop: "14px",
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-light)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "1px",
                          flexShrink: 0,
                        }}
                      >
                        Live Preview
                      </span>
                      <button
                        style={{
                          padding: "5px 14px",
                          borderRadius: "8px",
                          background: "var(--accent-primary, #22d3ee)",
                          color: "#000",
                          border: "none",
                          fontWeight: 700,
                          fontSize: "11px",
                          cursor: "default",
                        }}
                      >
                        Button
                      </button>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "6px",
                          background:
                            "color-mix(in srgb, var(--accent-primary,#22d3ee) 15%, transparent)",
                          color: "var(--accent-primary,#22d3ee)",
                          fontSize: "11px",
                          fontWeight: 700,
                          border:
                            "1px solid color-mix(in srgb, var(--accent-primary,#22d3ee) 30%, transparent)",
                        }}
                      >
                        Badge
                      </span>
                      <div
                        style={{
                          flex: 1,
                          minWidth: "80px",
                          height: "5px",
                          borderRadius: "99px",
                          background: "var(--bg-surface)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: "65%",
                            height: "100%",
                            borderRadius: "99px",
                            background: "var(--accent-primary, #22d3ee)",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "var(--accent-primary, #22d3ee)",
                          boxShadow: "0 0 8px var(--accent-primary, #22d3ee)",
                        }}
                      />
                    </div>

                    {/* Custom Color Input */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginTop: "10px",
                        background: "var(--bg-secondary)",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      <label
                        htmlFor="custom-accent-color-picker"
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--text-secondary)",
                          flex: 1,
                          cursor: "pointer",
                        }}
                      >
                        Custom Color:
                      </label>
                      <input
                        id="custom-accent-color-picker"
                        type="color"
                        value={customHex}
                        onChange={(e) =>
                          handleCustomAccentChange(e.target.value)
                        }
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          border: "none",
                          cursor: "pointer",
                          background: "transparent",
                        }}
                        title="Pick any custom color"
                      />
                      <input
                        type="text"
                        value={customHex}
                        onChange={(e) => {
                          setCustomHex(e.target.value);
                          if (/^#[0-9A-F]{6}$/i.test(e.target.value))
                            handleCustomAccentChange(e.target.value);
                        }}
                        placeholder="#22d3ee"
                        style={{
                          width: "85px",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-light)",
                          color: "var(--text-primary)",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          textTransform: "uppercase",
                        }}
                      />
                    </div>
                  </div>

                  {/* ── FONT STYLE SELECTOR ── */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "14px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "10px",
                          background: "rgba(251,191,36,0.1)",
                          border: "1px solid rgba(251,191,36,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: "14px",
                          color: "#fbbf24",
                        }}
                      >
                        Aa
                      </div>
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          Font Style
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "11px",
                            color: "var(--text-muted)",
                          }}
                        >
                          Global typeface for the entire workspace
                        </p>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                      }}
                    >
                      {FONT_OPTIONS.map((f) => {
                        const isSel = currentFont === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleFontChange(f.id)}
                            style={{
                              padding: "12px 14px",
                              borderRadius: "12px",
                              textAlign: "left",
                              cursor: "pointer",
                              background: isSel
                                ? "color-mix(in srgb, var(--accent-primary,#22d3ee) 10%, transparent)"
                                : "var(--bg-secondary)",
                              border: `1px solid ${isSel ? "var(--accent-primary, #22d3ee)" : "var(--border-light)"}`,
                              transition: "all 0.2s ease",
                            }}
                          >
                            <p
                              style={{
                                margin: "0 0 2px",
                                fontSize: "15px",
                                fontWeight: 700,
                                color: isSel
                                  ? "var(--accent-primary,#22d3ee)"
                                  : "var(--text-primary)",
                                fontFamily: f.family,
                              }}
                            >
                              {f.label}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "10px",
                                color: "var(--text-muted)",
                              }}
                            >
                              {f.hint}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : activeTab === "preferences" ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  {/* ── 1. DEFAULT STARTING SCREEN ── */}
                  <div
                    style={{
                      borderRadius: "16px",
                      padding: "18px 20px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "9px",
                          background: "rgba(34, 211, 238, 0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--accent-primary, #22d3ee)",
                        }}
                      >
                        <Compass size={17} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                          Default Starting Screen
                        </h4>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
                          Choose what opens automatically upon logging in
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
                      {[
                        { id: "news", label: "Live News", desc: "Headlines & feeds", icon: "📰" },
                        { id: "stocks", label: "Stock Market", desc: "Watchlist & charts", icon: "📈" },
                        { id: "files", label: "File Workspace", desc: "Document repository", icon: "📁" },
                        { id: "search", label: "Global Search", desc: "Omni-search engine", icon: "🔍" },
                      ].map((tab) => {
                        const isSelected = startingTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setStartingTab(tab.id);
                              localStorage.setItem("ak_default_starting_tab", tab.id);
                              if (username) {
                                localStorage.setItem(`ak_default_starting_tab_${username}`, tab.id);
                              }
                              if (typeof window !== "undefined") {
                                window.dispatchEvent(
                                  new CustomEvent("ak-starting-tab-changed", { detail: { startingTab: tab.id } })
                                );
                              }
                              showToast(`Default starting screen set to ${tab.label}`, "ok");
                            }}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "10px",
                              padding: "12px 14px",
                              borderRadius: "12px",
                              background: isSelected ? "rgba(34, 211, 238, 0.1)" : "rgba(255, 255, 255, 0.02)",
                              border: `1.5px solid ${isSelected ? "var(--accent-primary, #22d3ee)" : "var(--border-light)"}`,
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span style={{ fontSize: "18px" }}>{tab.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  color: isSelected ? "var(--accent-primary, #22d3ee)" : "var(--text-primary)",
                                }}
                              >
                                {tab.label}
                              </p>
                              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                                {tab.desc}
                              </p>
                            </div>
                            {isSelected && (
                              <div
                                style={{
                                  width: "16px",
                                  height: "16px",
                                  borderRadius: "50%",
                                  background: "var(--accent-primary, #22d3ee)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <Check size={11} color="#000" strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── 2. TIME & DATE FORMAT ── */}
                  <div
                    style={{
                      borderRadius: "16px",
                      padding: "18px 20px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "9px",
                          background: "rgba(16, 185, 129, 0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#10b981",
                        }}
                      >
                        <Clock size={17} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                          Time & Date Display
                        </h4>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
                          Choose clock format and calendar date sequence
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {/* Clock style */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            marginBottom: "6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Clock Format
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          {[
                            { id: "12h", label: "12-Hour (Standard)", sample: "05:30 PM" },
                            { id: "24h", label: "24-Hour (Railway)", sample: "17:30" },
                          ].map((fmt) => {
                            const isSelected = timeFormat === fmt.id;
                            return (
                              <button
                                key={fmt.id}
                                type="button"
                                onClick={() => {
                                  setTimeFormat(fmt.id as "12h" | "24h");
                                  localStorage.setItem("ak_time_format", fmt.id);
                                  window.dispatchEvent(new CustomEvent("ak-datetime-format-changed"));
                                  showToast(`Clock format set to ${fmt.label}`, "ok");
                                }}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: "10px",
                                  background: isSelected ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.02)",
                                  border: `1.5px solid ${isSelected ? "#10b981" : "var(--border-light)"}`,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: isSelected ? "#10b981" : "var(--text-primary)",
                                    }}
                                  >
                                    {fmt.label}
                                  </span>
                                  {isSelected && <Check size={14} color="#10b981" strokeWidth={2.5} />}
                                </div>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--text-muted)",
                                    display: "block",
                                    marginTop: "3px",
                                  }}
                                >
                                  e.g. {fmt.sample}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Date sequence */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            marginBottom: "6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Date Sequence
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          {[
                            { id: "dmy", label: "DD / MM / YYYY", sample: "08/11/2026 (Day First)" },
                            { id: "mdy", label: "MM / DD / YYYY", sample: "11/08/2026 (Month First)" },
                          ].map((fmt) => {
                            const isSelected = dateFormat === fmt.id;
                            return (
                              <button
                                key={fmt.id}
                                type="button"
                                onClick={() => {
                                  setDateFormat(fmt.id as "dmy" | "mdy");
                                  localStorage.setItem("ak_date_format", fmt.id);
                                  window.dispatchEvent(new CustomEvent("ak-datetime-format-changed"));
                                  showToast(`Date format set to ${fmt.label}`, "ok");
                                }}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: "10px",
                                  background: isSelected ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.02)",
                                  border: `1.5px solid ${isSelected ? "#10b981" : "var(--border-light)"}`,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: isSelected ? "#10b981" : "var(--text-primary)",
                                    }}
                                  >
                                    {fmt.label}
                                  </span>
                                  {isSelected && <Check size={14} color="#10b981" strokeWidth={2.5} />}
                                </div>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--text-muted)",
                                    display: "block",
                                    marginTop: "3px",
                                  }}
                                >
                                  {fmt.sample}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Live preview banner */}
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          background: "rgba(16, 185, 129, 0.06)",
                          border: "1px dashed rgba(16, 185, 129, 0.3)",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Live Preview:</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981", letterSpacing: "0.4px" }}>
                          {getFormattedPreview()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── 3. SOUND EFFECTS ── */}
                  <div
                    style={{
                      borderRadius: "16px",
                      padding: "18px 20px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            background: soundEffects ? "rgba(34, 211, 238, 0.12)" : "rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: soundEffects ? "var(--accent-primary, #22d3ee)" : "var(--text-muted)",
                            transition: "all 0.2s",
                          }}
                        >
                          {soundEffects ? <Volume2 size={19} /> : <VolumeX size={19} />}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                            Sound Effects & Audio
                          </h4>
                          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                            {soundEffects ? "Audio alerts and click sounds enabled" : "Silent mode — all UI sounds muted"}
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = !soundEffects;
                          setSoundEffects(next);
                          localStorage.setItem("ak_sound_effects", String(next));
                          if (next) {
                            playChime();
                            showToast("Sound effects enabled! 🔊", "ok");
                          } else {
                            showToast("Silent mode activated! 🔇", "ok");
                          }
                        }}
                        style={{
                          width: "48px",
                          height: "26px",
                          borderRadius: "20px",
                          background: soundEffects ? "var(--accent-primary, #22d3ee)" : "rgba(255, 255, 255, 0.15)",
                          position: "relative",
                          border: "none",
                          cursor: "pointer",
                          transition: "background 0.25s",
                          padding: "3px",
                        }}
                        aria-label="Toggle Sound Effects"
                      >
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "#ffffff",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                            transform: soundEffects ? "translateX(22px)" : "translateX(0px)",
                            transition: "transform 0.25s",
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* ── 4. ACTIVE DEVICES & SESSIONS ── */}
                  <div
                    style={{
                      borderRadius: "16px",
                      padding: "18px 20px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "9px",
                          background: "rgba(59, 130, 246, 0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#3b82f6",
                        }}
                      >
                        <Laptop size={17} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                          Active Devices & Security
                        </h4>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
                          Manage login sessions across your computers
                        </p>
                      </div>
                    </div>

                    {/* Current device card */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "12px",
                        background: "rgba(59, 130, 246, 0.05)",
                        border: "1px solid rgba(59, 130, 246, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "10px",
                            background: "rgba(59, 130, 246, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#60a5fa",
                          }}
                        >
                          <Monitor size={20} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {deviceInfo.os} PC · {deviceInfo.browser}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                            <span
                              style={{
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: "#10b981",
                                boxShadow: "0 0 8px #10b981",
                              }}
                            />
                            <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 600 }}>
                              This Device · Active Now
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Log out from other computers button */}
                    <button
                      type="button"
                      disabled={loggingOutOthers}
                      onClick={handleLogOutOtherDevices}
                      style={{
                        width: "100%",
                        padding: "11px 16px",
                        borderRadius: "10px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid var(--border-light)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: loggingOutOthers ? "wait" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                      }}
                    >
                      <Shield size={14} style={{ color: "#3b82f6" }} />
                      <span>{loggingOutOthers ? "Revoking Other Sessions…" : "Log Out of All Other Computers"}</span>
                    </button>
                  </div>

                  {/* ── 5. RESET PREFERENCES TO DEFAULT ── */}
                  <div
                    style={{
                      borderRadius: "16px",
                      padding: "16px 20px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                        Restore Defaults
                      </h4>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                        Reset starting screen, formats, sounds, and colors
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetDefaults}
                      style={{
                        padding: "9px 14px",
                        borderRadius: "10px",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid var(--border-light)",
                        color: "var(--text-primary)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent-primary, #22d3ee)";
                        e.currentTarget.style.color = "var(--accent-primary, #22d3ee)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-light)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Reset to Default</span>
                    </button>
                  </div>

                  {/* ── 6. DANGER ZONE: DELETE ACCOUNT ── */}
                  <div
                    style={{
                      borderRadius: "16px",
                      padding: "18px 20px",
                      background: "rgba(239, 68, 68, 0.05)",
                      border: "1px solid rgba(239, 68, 68, 0.22)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "9px",
                          background: "rgba(239, 68, 68, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ef4444",
                        }}
                      >
                        <AlertTriangle size={17} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f87171" }}>
                          Danger Zone
                        </h4>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
                          Irreversible account and personal data deletion
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "12px 0 14px", lineHeight: "1.5" }}>
                      Permanently erase your account, watchlist, uploaded files, and stored profile. This operation cannot be reversed.
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      style={{
                        width: "100%",
                        padding: "11px 16px",
                        borderRadius: "10px",
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        color: "#f87171",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.22)";
                        e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                        e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.35)";
                      }}
                    >
                      <Trash2 size={15} />
                      <span>Delete My Account</span>
                    </button>
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
                          style={{
                            margin: 0,
                            color: "var(--text-secondary)",
                            fontSize: "15px",
                          }}
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
                              background:
                                "linear-gradient(135deg,#2563eb,#0d9488)",
                              border: "none",
                              color: "white",
                              fontSize: "15px",
                              fontWeight: 700,
                              cursor: saving ? "wait" : "pointer",
                              boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
                            }}
                          >
                            <Save size={13} />{" "}
                            {saving ? "Saving…" : "Save Changes"}
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
                              {showOld ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
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
                              placeholder="Min. 8 characters"
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
                              {showNew ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                            </button>
                          </div>
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: "11px",
                              color: "var(--text-muted, #64748b)",
                              letterSpacing: "0.2px",
                            }}
                          >
                            Min. 8 chars · Upper & lowercase · Number · Symbol
                          </p>
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
                      e.currentTarget.style.borderColor =
                        "rgba(239,68,68,0.28)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.07)";
                      e.currentTarget.style.borderColor =
                        "rgba(239,68,68,0.14)";
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
                      <p
                        style={{
                          margin: 0,
                          color: "var(--text-secondary)",
                          fontSize: "15px",
                        }}
                      >
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
      {showPhotoViewer && profile?.avatar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 105,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            animation: "panelIn 0.18s ease-out forwards",
          }}
          onClick={() => setShowPhotoViewer(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "380px",
              background: "#0d111c",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
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
                    color: "var(--text-primary, #f8fafc)",
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  Profile Photo
                </h3>
                <p
                  style={{
                    margin: "2px 0 0",
                    color: "var(--text-secondary, #94a3b8)",
                    fontSize: "12px",
                  }}
                >
                  @{username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoViewer(false)}
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

            {/* Photo Preview */}
            <div
              style={{
                padding: "24px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "radial-gradient(circle at center, rgba(34, 211, 238, 0.05) 0%, transparent 70%)",
              }}
            >
              <div
                style={{
                  width: "220px",
                  height: "220px",
                  borderRadius: "28px",
                  overflow: "hidden",
                  boxShadow:
                    "0 12px 35px rgba(0, 0, 0, 0.6), 0 0 0 2px rgba(34, 211, 238, 0.35)",
                }}
              >
                <img
                  src={profile.avatar}
                  alt={profile.name || username}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div
              style={{
                padding: "16px 20px",
                background: "rgba(255, 255, 255, 0.02)",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  handleOpenAdjuster();
                }}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background:
                    "linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(6, 182, 212, 0.35)",
                }}
              >
                <Crop size={15} />
                <span>Adjust Alignment & Zoom</span>
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoViewer(false);
                    fileInputRef.current?.click();
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: "rgba(255, 255, 255, 0.04)",
                    color: "var(--text-primary, #f1f5f9)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Upload size={13} />
                  <span>Upload New</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoViewer(false);
                    handleRemoveAvatar();
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    background: "rgba(239, 68, 68, 0.08)",
                    color: "#ef4444",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT CONFIRMATION MODAL ── */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => !isDeletingAccount && setShowDeleteModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#0d111c",
              borderRadius: "18px",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95), 0 0 25px rgba(239, 68, 68, 0.15)",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f87171" }}>
                  Delete Account?
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                  @{username}
                </p>
              </div>
            </div>

            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              Are you sure you want to permanently delete your account? All your uploaded research files, chat records, stock watchlists, and profile information will be immediately deleted.
            </p>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                marginBottom: "18px",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#f87171", fontWeight: 600 }}>
                ⚠ Warning: This action is permanent and cannot be undone.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingAccount}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid var(--border-light)",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                style={{
                  flex: 1.4,
                  padding: "11px 16px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isDeletingAccount ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(220, 38, 38, 0.4)",
                }}
              >
                {isDeletingAccount ? "Deleting…" : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropperRawImage && (
        <PhotoCropperModal
          imageSrc={cropperRawImage}
          onCrop={(croppedDataUrl) => {
            setCropperRawImage(null);
            saveAvatar(croppedDataUrl);
          }}
          onCancel={() => {
            setCropperRawImage(null);
          }}
        />
      )}
    </>
  );
}
