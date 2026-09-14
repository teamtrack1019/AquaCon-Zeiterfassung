"use client";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "../context/LanguageContext";
import { SyncProvider } from "../context/SyncContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <SyncProvider>
          {children}
        </SyncProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
