"use client";
import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useSync } from "../context/SyncContext";

type ToastType = "online" | "offline" | "syncing" | "sync_success" | null;

export default function SyncToast() {
  const { t } = useLanguage();
  const { status, pendingCount } = useSync();
  const [toast, setToast] = useState<{ type: ToastType; messageKey: string; key: number } | null>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);

  useEffect(() => {
    // Only show toast when transitioning status (not on initial mount unless desired)
    if (prevStatus === null) {
      setPrevStatus(status);
      return;
    }

    if (prevStatus !== status) {
      if (status === "offline") {
        setToast({ type: "offline", messageKey: "toastOffline", key: Date.now() });
      } else if (status === "syncing") {
        setToast({ type: "syncing", messageKey: "toastSyncing", key: Date.now() });
      } else if (status === "online") {
        if (prevStatus === "syncing" || prevStatus === "offline") {
          setToast({ type: "sync_success", messageKey: "toastSyncSuccess", key: Date.now() });
        }
      }
      setPrevStatus(status);
    }
  }, [status, prevStatus]);

  useEffect(() => {
    const handleSyncDone = () => {
      setToast({ type: "sync_success", messageKey: "toastSyncSuccess", key: Date.now() });
    };
    window.addEventListener("aquacon_sync_completed", handleSyncDone);
    return () => window.removeEventListener("aquacon_sync_completed", handleSyncDone);
  }, []);

  // Auto-hide toast after 4 seconds (except if currently syncing)
  useEffect(() => {
    if (!toast || toast.type === "syncing") return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-md pointer-events-auto animate-bounce-short">
      <div
        className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 ${
          toast.type === "offline"
            ? "bg-amber-500/95 text-white border-amber-600 shadow-amber-500/20"
            : toast.type === "syncing"
            ? "bg-blue-600/95 text-white border-blue-700 shadow-blue-500/20"
            : "bg-emerald-600/95 text-white border-emerald-700 shadow-emerald-500/20"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            {toast.type === "offline" ? (
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                ⚠️
              </div>
            ) : toast.type === "syncing" ? (
              <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}
          </div>

          {/* Text Content */}
          <div className="text-xs sm:text-sm font-semibold tracking-wide">
            {t(toast.messageKey as any)}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setToast(null)}
          className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
