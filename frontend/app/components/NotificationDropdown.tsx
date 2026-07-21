"use client";
import { X, Check, Bell, Info, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import React, { useEffect, useRef } from "react";

export interface NotificationItem {
  id: string;
  type: "info" | "success" | "warning";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function NotificationDropdown({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearAll,
  onMarkRead,
  onDelete,
}: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return date.toLocaleDateString();
  };

  const getIcon = (type: NotificationItem["type"]) => {
    if (type === "success") return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (type === "warning") return <AlertCircle className="w-4 h-4 text-rose-400" />;
    return <Info className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "absolute",
        top: "50px",
        right: "0px",
        width: "360px",
        background: "rgba(10, 10, 26, 0.94)",
        border: "1px solid rgba(34, 211, 238, 0.22)",
        borderRadius: "14px",
        boxShadow: "0 12px 40px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backdropFilter: "blur(16px)",
        animation: "dropdown-fade-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Bell className="w-4 h-4 text-cyan-400" />
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa" }}>Notifications</span>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                color: "#ffffff",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {unreadCount} new
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#a1a1aa",
            padding: "4px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fafafa")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
        >
          <X size={15} />
        </button>
      </div>

      {/* Action buttons */}
      {notifications.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            background: "rgba(255, 255, 255, 0.01)",
          }}
        >
          <button
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            style={{
              background: "none",
              border: "none",
              fontSize: "11px",
              color: unreadCount === 0 ? "#52525b" : "#22d3ee",
              cursor: unreadCount === 0 ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Check size={12} />
            Mark all read
          </button>
          <button
            onClick={onClearAll}
            style={{
              background: "none",
              border: "none",
              fontSize: "11px",
              color: "#f43f5e",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Trash2 size={12} />
            Clear all
          </button>
        </div>
      )}

      {/* Notifications scroll body */}
      <div style={{ maxHeight: "280px", overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              color: "#71717a",
              fontSize: "13px",
            }}
          >
            All caught up! No notifications.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => onMarkRead(notif.id)}
              style={{
                display: "flex",
                gap: "12px",
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                background: notif.read ? "transparent" : "rgba(34, 211, 238, 0.03)",
                cursor: "pointer",
                transition: "background 0.15s ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = notif.read
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(34, 211, 238, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = notif.read
                  ? "transparent"
                  : "rgba(34, 211, 238, 0.03)";
              }}
            >
              {/* Status ring */}
              {!notif.read && (
                <div
                  style={{
                    position: "absolute",
                    left: "6px",
                    top: "16px",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#22d3ee",
                  }}
                />
              )}

              {/* Icon container */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {getIcon(notif.type)}
              </div>

              {/* Message block */}
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: notif.read ? "#d4d4d8" : "#fafafa",
                  }}
                >
                  {notif.title}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: notif.read ? "#71717a" : "#a1a1aa",
                    marginTop: "2px",
                    lineHeight: "1.4",
                    wordBreak: "break-word",
                  }}
                >
                  {notif.message}
                </div>
                <div style={{ fontSize: "10px", color: "#52525b", marginTop: "4px" }}>
                  {formatTime(notif.timestamp)}
                </div>
              </div>

              {/* Delete action */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notif.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#52525b",
                  padding: "4px",
                  height: "fit-content",
                  alignSelf: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#52525b")}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes dropdown-fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
