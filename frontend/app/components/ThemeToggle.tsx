"use client";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="btn btn-ghost p-2 relative group"
      style={{ transition: "all 0.2s ease" }}
    >
      <span
        style={{
          display: "inline-block",
          transform: `rotate(${theme === "dark" ? 180 : 0}deg)`,
          transition: "transform 0.3s ease-in-out",
        }}
      >
        {theme === "light" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#6b7280" }}
          >
            <title>Switch to dark mode</title>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#facc15" }}
          >
            <title>Switch to light mode</title>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </span>

      {/* Tooltip */}
      <span
        className="absolute -bottom-9 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap text-xs px-2 py-1 rounded"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-light)",
          color: "var(--text-secondary)",
          transition: "opacity 0.2s ease",
        }}
      >
        {theme === "light" ? "Dark" : "Light"} mode
      </span>
    </button>
  );
}
