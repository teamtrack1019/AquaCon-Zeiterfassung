"use client";
import { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useSync } from "../context/SyncContext";

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const { status, pendingCount, syncNow } = useSync();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="bg-white text-slate-800 px-4 py-3 sm:py-4 shadow-sm border-b flex justify-between items-center gap-2">
      <div className="flex items-center gap-3">
        {/* Yuvarlak Mavi Daire Logo */}
        <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 shadow-md flex-shrink-0">
          <span className="text-white font-bold text-[9px] sm:text-[10px] tracking-wide leading-none text-center">Aqua<br/>Con</span>
        </div>
        <div className="text-base sm:text-lg font-bold text-blue-700 hidden sm:block">
          Zeiterfassung
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Network & Sync Status Badge */}
        {mounted && (
          <button
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.onLine) syncNow();
            }}
            title={
              status === 'offline'
                ? 'Offline - Veriler telefonda saklanıyor'
                : status === 'syncing'
                ? 'Senkronize ediliyor...'
                : 'Online - Bağlantı aktif'
            }
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition-all ${
              status === 'online'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : status === 'offline'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse'
            }`}
          >
            {status === 'online' && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>🟢 {t('online')}</span>
              </>
            )}

            {status === 'offline' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>🟠 {t('offline')}{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
              </>
            )}

            {status === 'syncing' && (
              <>
                <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>🔵 {t('syncing')}{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
              </>
            )}
          </button>
        )}

        {/* Language Selector */}
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as 'de' | 'ru')}
          className="bg-slate-100 text-slate-700 border border-slate-300 rounded-lg p-1.5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="de">🇩🇪 DE</option>
          <option value="ru">🇷🇺 RU</option>
        </select>
      </div>
    </header>
  );
}
