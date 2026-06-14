"use client";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  // Restore saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("ak_theme");
    const dark = saved !== "light"; // default to dark
    setIsDark(dark);
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ak_theme", theme);
  };

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{
        width: "38px",
        height: "38px",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: isDark
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid rgba(0,0,0,0.1)",
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
        color: isDark ? "#fbbf24" : "#6366f1",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isDark
          ? "rgba(255,255,255,0.12)"
          : "rgba(0,0,0,0.09)";
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDark
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.05)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/* Sun icon for dark mode (click to go light) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.3s ease, transform 0.3s ease",
          opacity: isDark ? 1 : 0,
          transform: isDark
            ? "rotate(0deg) scale(1)"
            : "rotate(90deg) scale(0.5)",
        }}
      >
        <Sun size={17} strokeWidth={2} />
      </div>

      {/* Moon icon for light mode (click to go dark) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.3s ease, transform 0.3s ease",
          opacity: isDark ? 0 : 1,
          transform: isDark
            ? "rotate(-90deg) scale(0.5)"
            : "rotate(0deg) scale(1)",
        }}
      >
        <Moon size={17} strokeWidth={2} />
      </div>
    </button>
  );
}
