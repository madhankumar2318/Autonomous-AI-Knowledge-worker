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
} from "lucide-react";
import { useEffect, useState } from "react";

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
        `http://127.0.0.1:8000/auth/profile?username=${encodeURIComponent(username)}`,
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
      fd.append("username", username);
      fd.append("name", editName);
      fd.append("email", editEmail);
      fd.append("mobile", editMobile);
      const res = await fetch("http://127.0.0.1:8000/auth/profile", {
        method: "PUT",
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
    if (newPw.length < 4)
      return setPwError("New password must be at least 4 characters.");
    if (newPw !== confirmPw) return setPwError("New passwords do not match.");
    setPwSaving(true);
    try {
      const fd = new FormData();
      fd.append("username", username);
      fd.append("old_password", oldPw);
      fd.append("new_password", newPw);
      const res = await fetch("http://127.0.0.1:8000/auth/password", {
        method: "PUT",
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

              {/* Avatar with animated ring */}
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
                    background:
                      "linear-gradient(135deg, #2563eb, #0d9488, #2563eb)",
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
                    background:
                      "linear-gradient(145deg, #1d4ed8 0%, #0d9488 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "34px",
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
                  margin: "0 0 16px",
                  color: "var(--text-secondary)",
                  fontSize: "16px",
                  fontWeight: 500,
                }}
              >
                @{username}
              </p>

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

            {/* ════ BODY ════ */}
            <div style={{ flex: 1, padding: "24px" }}>
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
      `}</style>
    </>
  );
}
