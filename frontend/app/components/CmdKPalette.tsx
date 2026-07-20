"use client";
import { Search, Sparkles, Terminal, RefreshCw, Moon, Sun, Eclipse } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";

interface CmdKPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CmdKPalette({
  isOpen,
  onClose,
}: CmdKPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Handle global Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTheme = (typeof window !== "undefined" ? localStorage.getItem("ak_theme") : "dark") as "dark" | "light" | "oled" || "dark";
  const activeModel = typeof window !== "undefined" ? localStorage.getItem("ak_selected_model") || "llama-70b" : "llama-70b";

  const setTheme = (theme: "dark" | "light" | "oled") => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ak_theme", theme);
    window.dispatchEvent(new CustomEvent("ak-theme-changed", { detail: theme }));
    onClose();
  };

  const selectModel = (model: string) => {
    localStorage.setItem("ak_selected_model", model);
    localStorage.setItem("ak_selected_model_modified", "true");
    window.dispatchEvent(new CustomEvent("ak-model-changed", { detail: model }));
    onClose();
  };

  const commands = [
    {
      id: "new-chat",
      title: "Start a New Chat",
      subtitle: "Clears active thread and starts a fresh conversation",
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      action: () => {
        window.dispatchEvent(new CustomEvent("ak-new-chat"));
        onClose();
      },
    },
    {
      id: "model-llama",
      title: "Switch Model: Llama 3.3 (Groq)",
      subtitle: "Run high-speed reasoning with Llama 70B",
      icon: <Terminal className="w-4 h-4 text-purple-400" />,
      action: () => selectModel("llama-70b"),
      active: activeModel === "llama-70b",
    },
    {
      id: "model-gemini-pro",
      title: "Switch Model: Gemini Pro",
      subtitle: "Advanced logic & reasoning by Google",
      icon: <Terminal className="w-4 h-4 text-blue-400" />,
      action: () => selectModel("gemini-pro"),
      active: activeModel === "gemini-pro",
    },
    {
      id: "model-gemini-flash",
      title: "Switch Model: Gemini Flash",
      subtitle: "Lightweight, speedy responses",
      icon: <Terminal className="w-4 h-4 text-emerald-400" />,
      action: () => selectModel("gemini-flash"),
      active: activeModel === "gemini-flash",
    },
    {
      id: "theme-dark",
      title: "Switch Theme: Dark Mode",
      subtitle: "Sleek dark theme with cyber accents",
      icon: <Moon className="w-4 h-4 text-amber-400" />,
      action: () => setTheme("dark"),
      active: currentTheme === "dark",
    },
    {
      id: "theme-light",
      title: "Switch Theme: Light Mode",
      subtitle: "Clean and bright productivity theme",
      icon: <Sun className="w-4 h-4 text-sky-400" />,
      action: () => setTheme("light"),
      active: currentTheme === "light",
    },
    {
      id: "theme-oled",
      title: "Switch Theme: OLED Contrast Mode",
      subtitle: "True pure-black high contrast screen",
      icon: <Eclipse className="w-4 h-4 text-violet-400" />,
      action: () => setTheme("oled"),
      active: currentTheme === "oled",
    },
    {
      id: "clear-chat",
      title: "Clear Current Chat Logs",
      subtitle: "Resets the current chat feed without deleting the thread",
      icon: <RefreshCw className="w-4 h-4 text-rose-400" />,
      action: () => {
        window.dispatchEvent(new CustomEvent("ak-clear-chat"));
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 10, 20, 0.65)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "cmdk-fade-in 0.15s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "rgba(10, 10, 26, 0.94)",
          border: "1px solid rgba(34, 211, 238, 0.22)",
          borderRadius: "16px",
          boxShadow: "0 24px 64px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "cmdk-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input block */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <Search size={16} className="text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search settings..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: "14px",
              color: "#fafafa",
              fontFamily: "inherit",
            }}
          />
          <kbd
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "10px",
              color: "#a1a1aa",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Commands list */}
        <div
          style={{
            maxHeight: "340px",
            overflowY: "auto",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                color: "#71717a",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              No commands found matching &quot;{search}&quot;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: isSelected ? "rgba(34, 211, 238, 0.08)" : "transparent",
                    border: isSelected ? "1px solid rgba(34, 211, 238, 0.2)" : "1px solid transparent",
                    transition: "all 0.12s ease",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.03)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {cmd.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: cmd.active ? "#22d3ee" : isSelected ? "#fafafa" : "#e4e4e7",
                      }}
                    >
                      {cmd.title}
                      {cmd.active && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            background: "rgba(34, 211, 238, 0.15)",
                            color: "#22d3ee",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            marginLeft: "8px",
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "#71717a", marginTop: "2px" }}>
                      {cmd.subtitle}
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: "10px", color: "#22d3ee", fontWeight: 700 }}>
                      ⏎ Enter
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#52525b",
          }}
        >
          <span>Use ↑↓ arrows to navigate</span>
          <span>© AI Workspace Command Palette</span>
        </div>
      </div>

      <style>{`
        @keyframes cmdk-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cmdk-scale-in {
          from { transform: scale(0.96) translateY(8px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
