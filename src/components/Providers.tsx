"use client";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "../context/LanguageContext";
import { SyncProvider } from "../context/SyncContext";
import PullToRefresh from "./PullToRefresh";
import SyncToast from "./SyncToast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <SyncProvider>
          <PullToRefresh>
            <SyncToast />
            {children}
          </PullToRefresh>
        </SyncProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
