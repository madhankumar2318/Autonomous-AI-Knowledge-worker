"use client";
import {
  Eye,
  EyeOff,
  Lock,
  LogIn,
  User,
  Mail,
  Phone,
  UserPlus,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config";

interface LoginFormProps {
  onLoginSuccess: (username: string, token: string) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [isRegistering, setIsRegistering] = useState(false);

  // Shared States
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Login Only State
  const [rememberMe, setRememberMe] = useState(false);

  // Register Only States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      setLoading(false);
      firstInputRef.current?.focus();
      return;
    }

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const endpoint = isRegistering
        ? `${API_BASE_URL}/auth/register`
        : `${API_BASE_URL}/auth/login`;

      if (isRegistering) {
        if (name) formData.append("name", name);
        if (email) formData.append("email", email);
        if (mobile) formData.append("mobile", mobile);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.detail ||
            (isRegistering ? "Registration failed" : "Login failed"),
        );
      }

      const data = await res.json();
      console.log(isRegistering ? "Register success:" : "Login success:", data);

      if (isRegistering) {
        setSuccessMsg("Account created successfully! You can now log in.");
        setIsRegistering(false);
        setPassword("");
      } else {
        // Persist username if requested for Login
        try {
          if (rememberMe) localStorage.setItem("ak_user", username);
          else localStorage.removeItem("ak_user");
        } catch (_e) {
          /* ignore */
        }

        onLoginSuccess(username, data.token || "");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ak_user");
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch (_e) {
      /* ignore */
    }
    firstInputRef.current?.focus();
  }, []);

  // Clear errors when toggling mode
  useEffect(() => {
    setError("");
    setSuccessMsg("");
    firstInputRef.current?.focus();
  }, [isRegistering]);

  return (
    <>
      <div
        className="animate-fade-in w-full mx-auto auth-card"
        style={{
          transition: "max-width 0.4s cubic-bezier(0.25, 1, 0.5, 1), padding 0.4s ease",
          maxWidth: isRegistering ? "600px" : "420px",
          padding: "48px 40px",
          borderRadius: "28px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          background: "linear-gradient(160deg, rgba(10,12,24,0.94) 0%, rgba(5,6,12,0.98) 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.85), 0 0 40px rgba(34, 211, 238, 0.03), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Header Icon */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            className="header-icon-badge"
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              background: "linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(59,130,246,0.1) 100%)",
              border: "1px solid rgba(34,211,238,0.25)",
              boxShadow: "0 0 24px rgba(34,211,238,0.12), inset 0 1px 0 rgba(255,255,255,0.1)",
              backdropFilter: "blur(8px)",
            }}
          >
            {isRegistering ? (
              <UserPlus className="w-6 h-6 text-cyan-400 animate-fade-in" />
            ) : (
              <Lock className="w-6 h-6 text-cyan-400 animate-fade-in" />
            )}
          </div>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #ffffff 40%, #c8f5ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {isRegistering ? "Create Account" : "Welcome Back"}
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>
            {isRegistering
              ? "Join the AI Knowledge Dashboard"
              : "Sign in to your AI Knowledge Dashboard"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className={isRegistering ? "register-grid" : "login-stack"} style={isRegistering ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" } : { display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Full Name Field (Register Only) */}
            {isRegistering && (
              <div className="animate-fade-in">
                <label className="auth-label" htmlFor="auth-name">
                  Full Name
                </label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    id="auth-name"
                    ref={firstInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="auth-input"
                    required={isRegistering}
                  />
                </div>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label className="auth-label" htmlFor="auth-username">
                Username
              </label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="auth-username"
                  ref={!isRegistering ? firstInputRef : null}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isRegistering ? "Choose username" : "Username"}
                  className="auth-input"
                  required
                />
              </div>
            </div>

            {/* Email Field (Register Only) */}
            {isRegistering && (
              <div className="animate-fade-in">
                <label className="auth-label" htmlFor="auth-email">
                  Email Address
                </label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="auth-input"
                    required={isRegistering}
                  />
                </div>
              </div>
            )}

            {/* Mobile Field (Register Only) */}
            {isRegistering && (
              <div className="animate-fade-in">
                <label className="auth-label" htmlFor="auth-mobile">
                  Mobile Number
                </label>
                <div className="input-wrapper">
                  <Phone size={18} className="input-icon" />
                  <input
                    id="auth-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="auth-input"
                  />
                </div>
              </div>
            )}

            {/* Password Field (Full Width) */}
            <div className={isRegistering ? "col-span-full" : ""}>
              <label className="auth-label" htmlFor="auth-password">
                Password
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isRegistering
                      ? "Create a secure password"
                      : "Enter your password"
                  }
                  className="auth-input"
                  style={{
                    paddingRight: "46px",
                    letterSpacing: showPassword ? "normal" : "2px",
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="input-action-btn"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div
              className="animate-fade-in"
              id="auth-error"
              role="alert"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.25)",
                padding: "12px 16px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 600,
                marginTop: "10px",
              }}
            >
              ⚠ {error}
            </div>
          )}

          {successMsg && (
            <div
              className="animate-fade-in"
              role="alert"
              style={{
                background: "rgba(16,185,129,0.1)",
                color: "#34d399",
                border: "1px solid rgba(16,185,129,0.25)",
                padding: "12px 16px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 600,
                marginTop: "10px",
              }}
            >
              ✓ {successMsg}
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
            style={{
              width: "100%",
              height: "52px",
              borderRadius: "14px",
              border: "none",
              background: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
              color: "#030f1a",
              fontSize: "15px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 8px 24px rgba(34, 211, 238, 0.25)",
              marginTop: "12px",
            }}
          >
            {loading ? (
              <>
                <div
                  className="auth-spinner"
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: "2px solid rgba(3,15,26,0.25)",
                    borderTopColor: "#030f1a",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
                {isRegistering ? "Creating Account..." : "Securing Connection..."}
              </>
            ) : isRegistering ? (
              <>
                <UserPlus size={16} /> Create Account
              </>
            ) : (
              <>
                <LogIn size={16} /> Secure Login
              </>
            )}
          </button>

          {/* Footer Action Links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "16px",
              padding: "0 4px",
              gap: "16px",
            }}
          >
            {!isRegistering ? (
              <>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      width: "15px",
                      height: "15px",
                      accentColor: "#22d3ee",
                      cursor: "pointer",
                    }}
                  />
                  Remember device
                </label>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setIsRegistering(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#22d3ee",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Create new account
                </button>
              </>
            ) : (
              <button
                type="button"
                className="back-btn"
                onClick={() => setIsRegistering(false)}
                style={{
                  width: "100%",
                  height: "42px",
                  borderRadius: "20px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-light)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer",
                }}
              >
                <ArrowLeft size={14} /> Return to Login screen
              </button>
            )}
          </div>
        </form>

        <div style={{ textAlign: "center", marginTop: "32px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "20px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontWeight: 800,
              color: "var(--text-muted)",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Autonomous Knowledge Worker
          </p>
        </div>
      </div>

      <style>{`
        .auth-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 8px;
          padding-left: 4px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 15px;
          color: var(--text-muted);
          pointer-events: none;
          transition: color 0.25s ease, filter 0.25s ease;
        }

        .auth-input {
          width: 100%;
          height: 50px;
          padding-left: 46px;
          padding-right: 16px;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 500;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease;
        }

        .auth-input::placeholder {
          color: var(--text-muted);
          font-weight: 400;
        }

        .auth-input:hover {
          border-color: rgba(34, 211, 238, 0.25);
        }

        .auth-input:focus {
          border-color: var(--accent-primary);
          background: rgba(0, 0, 0, 0.5);
          box-shadow: 0 0 16px rgba(34, 211, 238, 0.15);
        }

        .input-wrapper:focus-within .input-icon {
          color: var(--accent-primary);
          filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.4));
        }

        .input-action-btn {
          position: absolute;
          right: 15px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .input-action-btn:hover {
          color: var(--text-primary);
        }

        .auth-submit-btn {
          transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease, filter 0.2s ease;
        }

        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-1.5px);
          filter: brightness(1.05);
          box-shadow: 0 10px 25px rgba(34, 211, 238, 0.35);
        }

        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(0.5px) scale(0.985);
        }

        .link-btn:hover {
          color: #67e8f9 !important;
          text-decoration: underline;
        }

        .back-btn {
          transition: background-color 0.2s, border-color 0.2s, color 0.2s;
        }

        .back-btn:hover {
          background: var(--bg-hover) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-medium) !important;
        }

        .col-span-full {
          grid-column: 1 / -1;
        }

        @media (max-width: 640px) {
          .register-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .auth-card {
            padding: 36px 24px !important;
            margin: 10px !important;
          }
        }
      `}</style>
    </>
  );
}
