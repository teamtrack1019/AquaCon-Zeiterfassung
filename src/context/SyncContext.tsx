"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

export interface OfflineAction {
  id: string;
  type: 'time' | 'leave';
  endpoint: string;
  method: string;
  payload: any;
  createdAt: number;
}

interface SyncContextType {
  status: NetworkStatus;
  pendingCount: number;
  queueAction: (action: Omit<OfflineAction, 'id' | 'createdAt'>) => void;
  syncNow: () => Promise<void>;
  isOffline: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const QUEUE_STORAGE_KEY = 'aquacon_offline_queue';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>('online');
  const [pendingCount, setPendingCount] = useState<number>(0);

  const getQueue = (): OfflineAction[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(QUEUE_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const saveQueue = (queue: OfflineAction[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      setPendingCount(queue.length);
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  };

  const syncNow = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const queue = getQueue();
    if (queue.length === 0) {
      setStatus('online');
      setPendingCount(0);
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      setPendingCount(queue.length);
      return;
    }

    setStatus('syncing');
    const remainingQueue: OfflineAction[] = [];

    for (const item of queue) {
      try {
        const res = await fetch(item.endpoint, {
          method: item.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });

        if (!res.ok && res.status >= 500) {
          // Server error - keep in queue to retry later
          remainingQueue.push(item);
        }
      } catch (err) {
        // Network error while trying to sync - keep item and stop sync loop
        remainingQueue.push(item);
        break;
      }
    }

    saveQueue(remainingQueue);

    if (remainingQueue.length === 0) {
      setStatus('online');
      // Trigger a global refresh event so dashboard/calendar re-fetches latest server state
      window.dispatchEvent(new CustomEvent('aquacon_sync_completed'));
    } else {
      setStatus('offline');
    }
  }, []);

  const queueAction = useCallback((action: Omit<OfflineAction, 'id' | 'createdAt'>) => {
    if (typeof window === 'undefined') return;
    const queue = getQueue();
    const newAction: OfflineAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    const updatedQueue = [...queue, newAction];
    saveQueue(updatedQueue);

    // If online, attempt immediate sync
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncNow();
    } else {
      setStatus('offline');
    }
  }, [syncNow]);

  useEffect(() => {
    // Initial status
    if (typeof window !== 'undefined') {
      const isCurrentlyOnline = navigator.onLine;
      const queue = getQueue();
      setPendingCount(queue.length);

      if (!isCurrentlyOnline) {
        setStatus('offline');
      } else if (queue.length > 0) {
        syncNow();
      } else {
        setStatus('online');
      }

      // Register service worker if supported
      if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('Service worker registration failed:', err);
        });
      }
    }

    const handleOnline = () => {
      setStatus('syncing');
      syncNow();
    };

    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic heartbeat sync check every 30 seconds
    const interval = setInterval(() => {
      if (navigator.onLine) {
        const queue = getQueue();
        if (queue.length > 0) {
          syncNow();
        } else {
          setStatus('online');
        }
      } else {
        setStatus('offline');
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncNow]);

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingCount,
        queueAction,
        syncNow,
        isOffline: status === 'offline',
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
