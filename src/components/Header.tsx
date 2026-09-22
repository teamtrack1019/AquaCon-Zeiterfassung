"use client";
import { useLanguage } from "../context/LanguageContext";
import { useSync } from "../context/SyncContext";

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const { status, pendingCount, syncNow } = useSync();

  return (
    <header className="bg-white text-slate-800 px-4 py-3 sm:py-4 shadow-sm border-b flex justify-between items-center gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Yuvarlak Mavi Daire Logo */}
        <img 
          src="/logo.png" 
          alt="AquaCon Logo" 
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-md flex-shrink-0 object-contain hover:scale-105 transition-transform" 
        />
        <div className="text-base sm:text-lg font-bold text-blue-700 hidden sm:block">
          Zeiterfassung
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Network & Sync Status Badge */}
        <button
          type="button"
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
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm transition-all flex-shrink-0 ${
            status === 'offline'
              ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300'
              : status === 'syncing'
              ? 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse'
              : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
          }`}
        >
          {status === 'offline' ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span>{t('offline')}{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
            </>
          ) : status === 'syncing' ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{t('syncing')}{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
            </>
          ) : (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <span>{t('online')}</span>
            </>
          )}
        </button>

        {/* Language Selector */}
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as 'de' | 'ru')}
          className="bg-slate-100 text-slate-700 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          <option value="de">🇩🇪 Deutsch</option>
          <option value="ru">🇷🇺 Русский</option>
        </select>
      </div>
    </header>
  );
}
