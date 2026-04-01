"use client";
import { Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const usernameRef = useRef<HTMLInputElement | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Basic client-side validation
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      setLoading(false);
      usernameRef.current?.focus();
      return;
    }

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Login failed");

      const data = await res.json();
      console.log("Login success:", data);

      // Persist username if requested
      try {
        if (rememberMe) localStorage.setItem("ak_user", username);
        else localStorage.removeItem("ak_user");
      } catch (_e) {
        /* ignore localStorage errors */
      }

      onLoginSuccess();
    } catch (_err) {
      setError("Invalid username or password");
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
    usernameRef.current?.focus();
  }, []);

  return (
    <div className="card animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">Welcome Back</h1>
        <p className="text-secondary text-sm">Sign in to your AI Knowledge Dashboard</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="space-y-4"
        aria-describedby={error ? "login-error" : undefined}
      >
        <div>
          <label
            className="block text-sm font-medium text-primary mb-2"
            htmlFor="login-username"
          >
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              id="login-username"
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="input input-with-icon-left"
              required
              aria-required="true"
              aria-invalid={!!error}
            />
          </div>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-primary mb-2"
            htmlFor="login-password"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="input input-with-icons-both"
              required
              aria-required="true"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" id="login-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              Logging in...
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Login
            </>
          )}
        </button>

        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded cursor-pointer"
              style={{ accentColor: "var(--accent-primary)" }}
            />
            Remember me
          </label>
          <button type="button" className="text-sm hover:underline" style={{ color: "var(--accent-primary)" }}>
            Forgot password?
          </button>
        </div>
      </form>

      <div className="text-center mt-6 pt-6 border-t border-light">
        <p className="text-xs text-muted">🚀 Autonomous AI Knowledge Worker</p>
      </div>
    </div>
  );
}
