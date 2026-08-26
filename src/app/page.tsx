"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Falsche Zugangsdaten");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <>
      <Header />
      <main className="flex flex-col items-center justify-center mt-20">
        <div className="bg-white p-8 rounded shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">{t('login')}</h1>
          {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <div>
            <label className="block text-sm font-semibold mb-2">{t('username')}</label>
            <input 
              type="text" 
              value={username}
              onChange={e => {
                let val = e.target.value;
                if (val.length > 0) {
                  val = val.charAt(0).toUpperCase() + val.slice(1);
                }
                setUsername(val);
              }}
              className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('password')}</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <button 
              type="submit" 
              className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
            >
              {t('login')}
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-4 text-center">
            (Für Testzwecke: Ein neuer Account wird bei Eingabe automatisch erstellt)
          </p>
        </div>
      </main>
    </>
  );
}
