"use client";
import { Sun, Moon, Eclipse } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | "oled">("dark");

  // Restore saved theme on mount
  useEffect(() => {
    const saved = (localStorage.getItem("ak_theme") as "dark" | "light" | "oled") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggle = () => {
    let next: "dark" | "light" | "oled" = "dark";
    if (theme === "dark") {
      next = "light";
    } else if (theme === "light") {
      next = "oled";
    } else {
      next = "dark";
    }
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ak_theme", next);
  };

  const isDark = theme === "dark";
  const isLight = theme === "light";
  const isOled = theme === "oled";

  return (
    <button
      onClick={toggle}
      title={`Switch theme (Current: ${theme})`}
      style={{
        width: "38px",
        height: "38px",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: isLight
          ? "1px solid rgba(0,0,0,0.1)"
          : "1px solid rgba(255,255,255,0.1)",
        background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
        color: isLight ? "#0891b2" : isOled ? "#a78bfa" : "#fbbf24",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isLight
          ? "rgba(0,0,0,0.09)"
          : "rgba(255,255,255,0.12)";
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isLight
          ? "rgba(0,0,0,0.05)"
          : "rgba(255,255,255,0.06)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/* Sun icon for light mode transition */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.25s ease, transform 0.25s ease",
          opacity: isDark ? 1 : 0,
          transform: isDark
            ? "rotate(0deg) scale(1)"
            : "rotate(90deg) scale(0.5)",
        }}
      >
        <Sun size={17} strokeWidth={2} />
      </div>

      {/* Moon icon for dark mode transition */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.25s ease, transform 0.25s ease",
          opacity: isLight ? 1 : 0,
          transform: isLight
            ? "rotate(0deg) scale(1)"
            : "rotate(-90deg) scale(0.5)",
        }}
      >
        <Moon size={17} strokeWidth={2} />
      </div>

      {/* Eclipse icon for OLED mode transition */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "opacity 0.25s ease, transform 0.25s ease",
          opacity: isOled ? 1 : 0,
          transform: isOled
            ? "rotate(0deg) scale(1)"
            : "rotate(180deg) scale(0.5)",
        }}
      >
        <Eclipse size={17} strokeWidth={2} />
      </div>
    </button>
  );
}
