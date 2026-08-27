"use client";
import { useLanguage } from "../context/LanguageContext";

export default function Header() {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="bg-white text-slate-800 p-4 shadow-sm border-b flex justify-between items-center">
      <div className="flex items-center gap-3">
        {/* Yuvarlak Mavi Daire Logo */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 shadow-md">
          <span className="text-white font-bold text-[10px] tracking-wide leading-none text-center">Aqua<br/>Con</span>
        </div>
        <div className="text-lg font-bold text-blue-700 hidden sm:block">
          Zeiterfassung
        </div>
      </div>
      <div>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as 'de' | 'ru')}
          className="bg-slate-100 text-slate-700 border border-slate-300 rounded p-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="de">🇩🇪 Deutsch</option>
          <option value="ru">🇷🇺 Русский</option>
        </select>
      </div>
    </header>
  );
}
