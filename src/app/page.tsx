"use client";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    // If already authenticated, redirect immediately
    if (status === "authenticated") {
      if ((session?.user as any)?.role === 'ADMIN') {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    // Restore saved username if available
    try {
      const savedUser = localStorage.getItem("aquacon_saved_username");
      if (savedUser) setUsername(savedUser);
    } catch (e) {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("aquacon_saved_username", username);
    } catch (e) {}
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

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500 font-medium">
        Laden...
      </div>
    );
  }

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
              <label className="block text-sm font-semibold mb-2">{t('password')}</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 pr-11 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
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
