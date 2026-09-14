"use client";
import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const THRESHOLD = 70;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 2 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      } else {
        isDragging.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0 && window.scrollY <= 2) {
        // Apply friction to pull
        const distance = Math.min(diff * 0.45, 90);
        setPullDistance(distance);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current || isRefreshing) return;
      isDragging.current = false;

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(50);
        
        // Trigger page refresh
        setTimeout(() => {
          window.location.reload();
        }, 400);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  return (
    <div className="relative min-h-screen">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center items-center pointer-events-none transition-all duration-150"
          style={{
            transform: `translateY(${Math.max(pullDistance, isRefreshing ? 50 : 0)}px)`,
          }}
        >
          <div className="bg-white/95 backdrop-blur shadow-lg border border-blue-200 rounded-full px-4 py-2 flex items-center gap-2 text-xs font-semibold text-blue-700">
            <svg
              className={`w-4 h-4 text-blue-600 ${
                isRefreshing || pullDistance >= THRESHOLD ? "animate-spin" : ""
              }`}
              style={{
                transform: isRefreshing ? undefined : `rotate(${pullDistance * 4}deg)`,
              }}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            <span>
              {isRefreshing
                ? t('refreshing')
                : pullDistance >= THRESHOLD
                ? t('releaseToRefresh')
                : t('pullToRefresh')}
            </span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
