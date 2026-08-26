"use client";
import { useLanguage } from "../context/LanguageContext";

export default function Header() {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
      <div className="text-xl font-bold">
        AquaCon
      </div>
      <div>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value as 'de' | 'ru')}
          className="bg-blue-700 text-white border border-blue-500 rounded p-1"
        >
          <option value="de">Deutsch</option>
          <option value="ru">Русский</option>
        </select>
      </div>
    </header>
  );
}


