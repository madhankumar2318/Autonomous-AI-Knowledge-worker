"use client";
import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    onClose: (id: string) => void;
}

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
};

const styles = {
    success: "alert-success",
    error: "alert-error",
    info: "alert-info",
    warning: "alert-warning",
};

function Toast({ id, type, message, onClose }: ToastProps) {
    const Icon = icons[type];

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, 3000);

        return () => clearTimeout(timer);
    }, [id, onClose]);

    return (
        <div
            className={`${styles[type]} flex items-center gap-3 min-w-[300px] max-w-md shadow-lg animate-slide-in`}
        >
            <Icon size={20} className="flex-shrink-0" />
            <p className="flex-1 font-medium text-sm">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="hover:bg-black/10 p-1 rounded transition"
            >
                <X size={18} />
            </button>
        </div>
    );
}

// Toast Container
export function ToastContainer() {
    const [toasts, setToasts] = useState<
        Array<{ id: string; type: ToastType; message: string }>
    >([]);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    // Expose addToast globally
    useEffect(() => {
        (window as any).addToast = (type: ToastType, message: string) => {
            const id = Math.random().toString(36).substr(2, 9);
            setToasts((prev) => [...prev, { id, type, message }]);
        };
    }, []);

    return (
        <div className="fixed top-20 right-6 z-[100] space-y-3">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onClose={removeToast} />
            ))}
        </div>
    );
}

// Helper function to show toasts
export function showToast(type: ToastType, message: string) {
    if (typeof window !== "undefined" && (window as any).addToast) {
        (window as any).addToast(type, message);
    }
}

export default Toast;
