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
  Globe,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config";

const COUNTRIES = [
  { code: "AR", name: "Argentina", dialCode: "+54", placeholder: "+54 9 11 1234-5678" },
  { code: "AU", name: "Australia", dialCode: "+61", placeholder: "+61 400 123 456" },
  { code: "AT", name: "Austria", dialCode: "+43", placeholder: "+43 664 1234567" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", placeholder: "+880 1712-345678" },
  { code: "BE", name: "Belgium", dialCode: "+32", placeholder: "+32 470 12 34 56" },
  { code: "BR", name: "Brazil", dialCode: "+55", placeholder: "+55 11 99999-9999" },
  { code: "CA", name: "Canada", dialCode: "+1", placeholder: "+1 (555) 000-0000" },
  { code: "CL", name: "Chile", dialCode: "+56", placeholder: "+56 9 1234 5678" },
  { code: "CN", name: "China", dialCode: "+86", placeholder: "+86 139 1234 5678" },
  { code: "CO", name: "Colombia", dialCode: "+57", placeholder: "+57 300 123 4567" },
  { code: "DK", name: "Denmark", dialCode: "+45", placeholder: "+45 12 34 56 78" },
  { code: "EG", name: "Egypt", dialCode: "+20", placeholder: "+20 100 123 4567" },
  { code: "FI", name: "Finland", dialCode: "+358", placeholder: "+358 40 1234567" },
  { code: "FR", name: "France", dialCode: "+33", placeholder: "+33 6 1234 5678" },
  { code: "DE", name: "Germany", dialCode: "+49", placeholder: "+49 170 1234567" },
  { code: "GR", name: "Greece", dialCode: "+30", placeholder: "+30 697 123 4567" },
  { code: "HK", name: "Hong Kong", dialCode: "+852", placeholder: "+852 9123 4567" },
  { code: "IN", name: "India", dialCode: "+91", placeholder: "+91 99999 99999" },
  { code: "ID", name: "Indonesia", dialCode: "+62", placeholder: "+62 812-3456-7890" },
  { code: "IE", name: "Ireland", dialCode: "+353", placeholder: "+353 87 123 4567" },
  { code: "IL", name: "Israel", dialCode: "+972", placeholder: "+972 50-123-4567" },
  { code: "IT", name: "Italy", dialCode: "+39", placeholder: "+39 333 123 4567" },
  { code: "JP", name: "Japan", dialCode: "+81", placeholder: "+81 90-1234-5678" },
  { code: "KE", name: "Kenya", dialCode: "+254", placeholder: "+254 712 345678" },
  { code: "MY", name: "Malaysia", dialCode: "+60", placeholder: "+60 12-345 6789" },
  { code: "MX", name: "Mexico", dialCode: "+52", placeholder: "+52 55 1234 5678" },
  { code: "NP", name: "Nepal", dialCode: "+977", placeholder: "+977 980-1234567" },
  { code: "NL", name: "Netherlands", dialCode: "+31", placeholder: "+31 6 12345678" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", placeholder: "+64 21 123 4567" },
  { code: "NG", name: "Nigeria", dialCode: "+234", placeholder: "+234 803 123 4567" },
  { code: "NO", name: "Norway", dialCode: "+47", placeholder: "+47 912 34 567" },
  { code: "PK", name: "Pakistan", dialCode: "+92", placeholder: "+92 300 1234567" },
  { code: "PE", name: "Peru", dialCode: "+51", placeholder: "+51 912 345 678" },
  { code: "PH", name: "Philippines", dialCode: "+63", placeholder: "+63 912 345 6789" },
  { code: "PL", name: "Poland", dialCode: "+48", placeholder: "+48 501 123 456" },
  { code: "PT", name: "Portugal", dialCode: "+351", placeholder: "+351 912 345 678" },
  { code: "RO", name: "Romania", dialCode: "+40", placeholder: "+40 722 123 456" },
  { code: "RU", name: "Russia", dialCode: "+7", placeholder: "+7 999 123-45-67" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", placeholder: "+966 50 123 4567" },
  { code: "SG", name: "Singapore", dialCode: "+65", placeholder: "+65 9123 4567" },
  { code: "ZA", name: "South Africa", dialCode: "+27", placeholder: "+27 82 123 4567" },
  { code: "KR", name: "South Korea", dialCode: "+82", placeholder: "+82 10-1234-5678" },
  { code: "ES", name: "Spain", dialCode: "+34", placeholder: "+34 600 123 456" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", placeholder: "+94 77 123 4567" },
  { code: "SE", name: "Sweden", dialCode: "+46", placeholder: "+46 70 123 45 67" },
  { code: "CH", name: "Switzerland", dialCode: "+41", placeholder: "+41 78 123 45 67" },
  { code: "TW", name: "Taiwan", dialCode: "+886", placeholder: "+886 912 345 678" },
  { code: "TH", name: "Thailand", dialCode: "+66", placeholder: "+66 81 234 5678" },
  { code: "TR", name: "Turkey", dialCode: "+90", placeholder: "+90 532 123 4567" },
  { code: "UA", name: "Ukraine", dialCode: "+380", placeholder: "+380 50 123 4567" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", placeholder: "+971 50 123 4567" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", placeholder: "+44 7911 123456" },
  { code: "US", name: "United States", dialCode: "+1", placeholder: "+1 (555) 000-0000" },
  { code: "VN", name: "Vietnam", dialCode: "+84", placeholder: "+84 91 234 5678" },
];

interface LoginFormProps {
  onLoginSuccess: (username: string, token: string) => void;
}

const getPasswordScore = (pw: string) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  return score;
};

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
  const [country, setCountry] = useState("US");
  const [phonePlaceholder, setPhonePlaceholder] = useState("+1 (555) 000-0000");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);


  const handleCountrySelect = (code: string) => {
    setCountry(code);
    const selected = COUNTRIES.find((c) => c.code === code);
    if (selected) {
      const cleanPlaceholder = selected.placeholder.replace(selected.dialCode, "").trim();
      setPhonePlaceholder(cleanPlaceholder);
    }
  };

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    if (isRegistering) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        setLoading(false);
        return;
      }
      if (password.length > 128) {
        setError("Password must be at most 128 characters long.");
        setLoading(false);
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Password must contain at least one uppercase letter.");
        setLoading(false);
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError("Password must contain at least one lowercase letter.");
        setLoading(false);
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Password must contain at least one number.");
        setLoading(false);
        return;
      }
      if (!/[^a-zA-Z0-9]/.test(password)) {
        setError("Password must contain at least one special character.");
        setLoading(false);
        return;
      }
    }

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
        if (mobile.trim()) {
          const selected = COUNTRIES.find((c) => c.code === country);
          const prefix = selected ? selected.dialCode : "";
          formData.append("mobile", `${prefix} ${mobile.trim()}`);
        }
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
        setConfirmPassword("");
        setCountry("US");
        setPhonePlaceholder("+1 (555) 000-0000");
        setIsCountryDropdownOpen(false);
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
    setConfirmPassword("");
    setCountry("US");
    setPhonePlaceholder("(555) 000-0000");
    setMobile("");
    setIsCountryDropdownOpen(false);
    firstInputRef.current?.focus();
  }, [isRegistering]);

  const filteredCountries = [...COUNTRIES]
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div
        className="animate-fade-in w-full mx-auto auth-card"
        style={{
          maxWidth: isRegistering ? "600px" : "420px",
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
              background: "linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(6,182,212,0.1) 100%)",
              border: "1px solid rgba(168,85,247,0.25)",
              boxShadow: "0 0 24px rgba(168,85,247,0.12), inset 0 1px 0 rgba(255,255,255,0.1)",
              backdropFilter: "blur(8px)",
            }}
          >
            {isRegistering ? (
              <UserPlus className="w-6 h-6 text-purple-400 animate-fade-in" />
            ) : (
              <Lock className="w-6 h-6 text-purple-400 animate-fade-in" />
            )}
          </div>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #ffffff 40%, #ebd5ff 100%)",
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
          <div className={isRegistering ? "register-grid" : "login-stack"}>
            
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

            {/* Country Field (Register Only) */}
            {isRegistering && (
              <div className="animate-fade-in custom-dropdown-container">
                <label className="auth-label" htmlFor="auth-country">
                  Country
                </label>
                <div
                  className="input-wrapper"
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  style={{ cursor: "pointer" }}
                >
                  <Globe size={18} className="input-icon" />
                  <div
                    className="auth-input"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingRight: "16px",
                      lineHeight: "48px"
                    }}
                  >
                    <span>{COUNTRIES.find((c) => c.code === country)?.name || "Select Country"}</span>
                    <ChevronDown size={16} className="text-muted" />
                  </div>
                </div>

                {isCountryDropdownOpen && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 40 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCountryDropdownOpen(false);
                      }}
                    />
                    <div className="custom-dropdown-menu">
                      <div className="custom-dropdown-items-wrapper">
                        {filteredCountries.map((c) => (
                          <div
                            key={c.code}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCountrySelect(c.code);
                              setIsCountryDropdownOpen(false);
                            }}
                            className={`custom-dropdown-item ${country === c.code ? "active" : ""}`}
                          >
                            {c.name}
                          </div>
                        ))}
                        {filteredCountries.length === 0 && (
                          <div
                            style={{
                              padding: "12px",
                              textAlign: "center",
                              color: "var(--text-muted)",
                              fontSize: "13px"
                            }}
                          >
                            No countries found
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile Field (Register Only) */}
            {isRegistering && (
              <div className="animate-fade-in col-span-full">
                <label className="auth-label" htmlFor="auth-mobile">
                  Mobile Number
                </label>
                <div className="input-wrapper" style={{ position: "relative" }}>
                  <Phone size={18} className="input-icon" />
                  <span
                    style={{
                      position: "absolute",
                      left: "42px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-primary)",
                      fontWeight: "600",
                      fontSize: "14px",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {COUNTRIES.find((c) => c.code === country)?.dialCode || ""}
                  </span>
                  <input
                    id="auth-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder={phonePlaceholder}
                    className="auth-input"
                    style={{
                      paddingLeft: `${
                        ((COUNTRIES.find((c) => c.code === country)?.dialCode || "").length * 8) + 48
                      }px`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div>
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

              {/* Password Strength Indicator (Register Only) */}
              {isRegistering && password && (
                <div className="animate-fade-in" style={{ marginTop: "8px", padding: "0 4px" }}>
                  <div style={{ display: "flex", gap: "4px", height: "4px", borderRadius: "2px", overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
                    {[...Array(5)].map((_, i) => {
                      const score = getPasswordScore(password);
                      const active = i < score;
                      let bg = "transparent";
                      if (active) {
                        if (score <= 2) bg = "#ef4444"; // Weak (red)
                        else if (score <= 4) bg = "#f59e0b"; // Medium (amber)
                        else bg = "#10b981"; // Strong (green)
                      }
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            background: bg,
                            transition: "background-color 0.3s ease",
                          }}
                        />
                      );
                    })}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color:
                        getPasswordScore(password) <= 2
                          ? "#ef4444"
                          : getPasswordScore(password) <= 4
                          ? "#fbbf24"
                          : "#34d399",
                      marginTop: "6px",
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {getPasswordScore(password) <= 2
                        ? "Weak Password"
                        : getPasswordScore(password) <= 4
                        ? "Medium Security"
                        : "Strong & Secure"}
                    </span>
                    <span style={{ opacity: 0.7 }}>
                      {password.length}/128 chars
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field (Register Only) */}
            {isRegistering && (
              <div className="animate-fade-in">
                <label className="auth-label" htmlFor="auth-confirm-password">
                  Confirm Password
                </label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="auth-input"
                    style={{
                      paddingRight: "46px",
                      letterSpacing: showConfirmPassword ? "normal" : "2px",
                    }}
                    required={isRegistering}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="input-action-btn"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>
            )}
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
              background: "linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 8px 24px rgba(139, 92, 246, 0.25)",
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
                    border: "2px solid rgba(255,255,255,0.25)",
                    borderTopColor: "#ffffff",
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
          <div className="auth-footer-container">
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

        <div className="auth-card-footer">
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
          border-color: rgba(168, 85, 247, 0.3) !important;
        }

        .auth-input:focus {
          border-color: #a855f7 !important;
          background: rgba(0, 0, 0, 0.55);
          box-shadow: 0 0 16px rgba(168, 85, 247, 0.2) !important;
        }

        .input-wrapper:focus-within .input-icon {
          color: #a855f7 !important;
          filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.4)) !important;
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
          box-shadow: 0 10px 25px rgba(139, 92, 246, 0.4);
        }

        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(0.5px) scale(0.985);
        }

        .link-btn:hover {
          color: #d8b4fe !important;
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

        .custom-dropdown-container {
          position: relative;
        }
        .custom-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          width: 100%;
          background: rgba(8, 10, 19, 0.85) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 14px;
          z-index: 50;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6) !important;
          padding: 6px;
          display: flex;
          flex-direction: column;
        }


        .custom-dropdown-items-wrapper {
          max-height: 180px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .custom-dropdown-items-wrapper::-webkit-scrollbar {
          width: 6px;
        }
        .custom-dropdown-items-wrapper::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-dropdown-items-wrapper::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 3px;
        }
        .custom-dropdown-items-wrapper::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }
        .custom-dropdown-item {
          padding: 9px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }
        .custom-dropdown-item:hover {
          background: rgba(34, 211, 238, 0.08);
          color: var(--text-primary);
        }
        .custom-dropdown-item.active {
          background: rgba(34, 211, 238, 0.12);
          color: #22d3ee;
          font-weight: 700;
        }

        .auth-card {
          transition: max-width 0.4s cubic-bezier(0.25, 1, 0.5, 1), padding 0.4s ease;
          padding: 48px 40px;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          background: rgba(10, 12, 24, 0.55) !important;
          backdrop-filter: blur(32px) !important;
          -webkit-backdrop-filter: blur(32px) !important;
          box-shadow: 0 24px 60px -12px rgba(0,0,0,0.85), 0 0 50px rgba(34, 211, 238, 0.04), inset 0 1px 0 rgba(255,255,255,0.08) !important;
          box-sizing: border-box;
        }

        .header-icon-badge {
          animation: float-badge 3s ease-in-out infinite;
        }

        @keyframes float-badge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .auth-footer-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
          padding: 0 4px;
          gap: 16px;
        }

        .auth-card-footer {
          text-align: center;
          margin-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 20px;
        }

        .login-stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .register-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
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
            width: 100% !important;
            max-width: 92% !important;
            padding: 32px 20px !important;
            border-radius: 20px !important;
            box-shadow: 0 16px 40px rgba(0,0,0,0.6) !important;
          }
          .auth-card h1 {
            font-size: 24px !important;
          }
        }

        @media (max-width: 480px) {
          .auth-footer-container {
            flex-direction: column !important;
            align-items: center !important;
            gap: 14px !important;
            margin-top: 20px !important;
          }
          .auth-card-footer {
            margin-top: 24px !important;
            padding-top: 16px !important;
          }
        }

        @media (max-height: 700px) {
          .auth-card {
            padding: 20px 16px !important;
            border-radius: 16px !important;
          }
          .auth-card h1 {
            font-size: 20px !important;
            margin-bottom: 4px !important;
          }
          .header-icon-badge {
            width: 48px !important;
            height: 48px !important;
            margin-bottom: 12px !important;
          }
          .auth-footer-container {
            margin-top: 12px !important;
            gap: 10px !important;
          }
          .auth-card-footer {
            margin-top: 16px !important;
            padding-top: 12px !important;
          }
          .auth-input {
            height: 44px !important;
          }
          .auth-submit-btn {
            height: 44px !important;
            margin-top: 8px !important;
          }
          .auth-label {
            margin-bottom: 4px !important;
          }
        }
      `}</style>
    </>
  );
}
