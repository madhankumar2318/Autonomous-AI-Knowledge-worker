"use client";
import { Eye, EyeOff, Lock, LogIn, User, Mail, Phone, UserPlus, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LoginFormProps {
  onLoginSuccess: () => void;
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

      const endpoint = isRegistering ? "http://127.0.0.1:8000/auth/register" : "http://127.0.0.1:8000/auth/login";

      if (isRegistering) {
        if (name) formData.append("name", name);
        if (email) formData.append("email", email);
        if (mobile) formData.append("mobile", mobile);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || (isRegistering ? "Registration failed" : "Login failed"));
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
        } catch (_e) { /* ignore */ }

        onLoginSuccess();
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
    } catch (_e) { /* ignore */ }
    firstInputRef.current?.focus();
  }, []);

  // Clear errors when toggling mode
  useEffect(() => {
    setError("");
    setSuccessMsg("");
    firstInputRef.current?.focus();
  }, [isRegistering]);

  return (
    <div
      className="animate-fade-in w-full mx-auto"
      style={{
        transition: "max-width 0.5s ease, padding 0.5s ease",
        maxWidth: isRegistering ? "640px" : "420px",
        padding: "48px 40px",
        borderRadius: "32px",
        border: "1px solid rgba(59,130,246,0.2)",
        background: "linear-gradient(160deg, rgba(8,14,30,0.92) 0%, rgba(4,8,20,0.97) 100%)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 0 0 1px rgba(59,130,246,0.08), 0 32px 64px -16px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)"
      }}
    >
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-5"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(13,148,136,0.2) 100%)", border: "1px solid rgba(59,130,246,0.3)", boxShadow: "0 0 20px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)", transition: "all 0.3s ease", backdropFilter: "blur(8px)" }}
        >
          {isRegistering ? <UserPlus className="w-7 h-7 text-white animate-fade-in" /> : <Lock className="w-7 h-7 text-white animate-fade-in" />}
        </div>
        <h1 className="text-[26px] font-extrabold text-white tracking-tight mb-2">
          {isRegistering ? "Create Account" : "Welcome Back"}
        </h1>
        <p className="text-[14px] text-zinc-400 font-medium">
          {isRegistering ? "Join the AI Knowledge Dashboard" : "Sign in to your AI Knowledge Dashboard"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        aria-describedby={error ? "auth-error" : undefined}
      >
        <div className={isRegistering ? "grid grid-cols-2 gap-5" : "space-y-5"}>

          {/* Name Field (Register Only) */}
          {isRegistering && (
            <div className="animate-fade-in col-span-1">
              <label className="block text-[13px] font-semibold text-zinc-300 mb-2 pl-1" htmlFor="auth-name">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 pointer-events-none" />
                <input
                  id="auth-name"
                  ref={firstInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  style={{
                    width: "100%", height: "50px", paddingLeft: "44px", borderRadius: "14px",
                    background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)",
                    transition: "all 0.2s ease", color: "white", fontSize: "14px"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(168,85,247,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                  required={isRegistering}
                />
              </div>
            </div>
          )}

          {/* Username Field */}
          <div className={isRegistering ? "col-span-1" : ""}>
            <label className="block text-[13px] font-semibold text-zinc-300 mb-2 pl-1" htmlFor="auth-username">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 pointer-events-none" />
              <input
                id="auth-username"
                ref={!isRegistering ? firstInputRef : null}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                style={{
                  width: "100%", height: "50px", paddingLeft: "44px", borderRadius: "14px",
                  background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)",
                  transition: "all 0.2s ease", color: "white", fontSize: "14px"
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(168,85,247,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                required
              />
            </div>
          </div>

          {/* Email Field (Register Only) */}
          {isRegistering && (
            <div className="animate-fade-in col-span-1">
              <label className="block text-[13px] font-semibold text-zinc-300 mb-2 pl-1" htmlFor="auth-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  style={{
                    width: "100%", height: "50px", paddingLeft: "44px", borderRadius: "14px",
                    background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)",
                    transition: "all 0.2s ease", color: "white", fontSize: "14px"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(168,85,247,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                  required={isRegistering}
                />
              </div>
            </div>
          )}

          {/* Mobile Field (Register Only) */}
          {isRegistering && (
            <div className="animate-fade-in col-span-1">
              <label className="block text-[13px] font-semibold text-zinc-300 mb-2 pl-1" htmlFor="auth-mobile">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 pointer-events-none" />
                <input
                  id="auth-mobile"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={{
                    width: "100%", height: "50px", paddingLeft: "44px", borderRadius: "14px",
                    background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)",
                    transition: "all 0.2s ease", color: "white", fontSize: "14px"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(168,85,247,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                />
              </div>
            </div>
          )}

          {/* Password Field (Full Width in both modes) */}
          <div className={isRegistering ? "col-span-2" : ""}>
            <label className="block text-[13px] font-semibold text-zinc-300 mb-2 pl-1" htmlFor="auth-password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500 pointer-events-none" />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegistering ? "Create a secure password" : "Enter your password"}
                style={{
                  width: "100%", height: "50px", paddingLeft: "44px", paddingRight: "44px", borderRadius: "14px",
                  background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)",
                  transition: "all 0.2s ease", color: "white", fontSize: "14px", letterSpacing: showPassword ? "normal" : "2px"
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(168,85,247,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.05)"}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                style={{ background: "transparent", border: "none" }}
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error animate-fade-in mt-6" id="auth-error" role="alert" style={{ borderRadius: "12px", padding: "12px", fontSize: "13px" }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success animate-fade-in mt-6" role="alert" style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", padding: "12px", borderRadius: "12px", fontSize: "13px" }}>
            {successMsg}
          </div>
        )}

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 mt-8 h-[54px] font-bold text-[15px] transition-all"
          style={{
            background: "linear-gradient(to right, #8b5cf6, #3b82f6)",
            border: "none",
            color: "white",
            borderRadius: "14px",
            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.3)",
            cursor: loading ? "wait" : "pointer",
            transform: "translateY(0)"
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              {isRegistering ? "Registering..." : "Authenticating..."}
            </>
          ) : isRegistering ? (
            <>
              Create Account
            </>
          ) : (
            <>
              Secure Login
            </>
          )}
        </button>

        {/* Toggles and Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 mt-4 gap-4 px-1">
          {!isRegistering ? (
            <>
              <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer select-none text-zinc-400 hover:text-zinc-300 transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded cursor-pointer"
                  style={{ accentColor: "#8b5cf6", backgroundColor: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                Remember my device
              </label>
              <button
                type="button"
                className="text-[13px] font-bold tracking-wide transition-colors"
                style={{ color: "#a78bfa", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#c4b5fd"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#a78bfa"}
                onClick={() => setIsRegistering(true)}
              >
                Create new account
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-[13px] font-semibold flex items-center justify-center gap-2 mx-auto py-2.5 px-6 rounded-full text-zinc-300 hover:text-white transition-all shadow-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onClick={() => setIsRegistering(false)}
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Login screen
            </button>
          )}
        </div>
      </form>

      <div className="text-center mt-8 pt-6">
        <p className="text-[11px] font-bold text-zinc-600/60 uppercase tracking-[0.2em]">Autonomous Knowledge Worker</p>
      </div>
    </div>
  );
}
