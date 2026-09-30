"use client";
import { useSession, signOut } from "next-auth/react";
import Header from "@/components/Header";
import { useLanguage } from "@/context/LanguageContext";
import { useSync } from "@/context/SyncContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CalendarAndExport from "@/components/CalendarAndExport";
import { workerDisplayName } from "@/lib/displayName";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const { queueAction } = useSync();
  const router = useRouter();

  const [entry, setEntry] = useState<any>(null);
  const [pause, setPause] = useState("0.5");
  const [travel, setTravel] = useState("0");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshCal, setRefreshCal] = useState(0);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPause, setEditPause] = useState("");
  const [editTravel, setEditTravel] = useState("");
  const [editLocation, setEditLocation] = useState("");

  // Leave Management State
  const [userDetails, setUserDetails] = useState<any>(null);
  const [leaveType, setLeaveType] = useState("URLAUB");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");

  const [elapsedTime, setElapsedTime] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
      if (entry?.startTime && !entry?.endTime) {
        const startParts = entry.startTime.split(':');
        const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const currentSecs = now.getSeconds();
        
        let diffMins = currentMins - startMins;
        if (diffMins < 0) diffMins += 24 * 60;
        
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        
        setElapsedTime(`${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${currentSecs.toString().padStart(2, '0')}`);
      } else {
        setElapsedTime("");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [entry]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      if ((session?.user as any)?.role === 'ADMIN') {
        router.push("/admin");
      } else {
        fetchEntry();
        fetchUserDetails();
      }
    }
  }, [status, router, session]);

  useEffect(() => {
    const handleSyncCompleted = () => {
      fetchEntry();
      fetchUserDetails();
      setRefreshCal(prev => prev + 1);
    };
    window.addEventListener('aquacon_sync_completed', handleSyncCompleted);
    return () => window.removeEventListener('aquacon_sync_completed', handleSyncCompleted);
  }, []);

  const fetchUserDetails = async () => {
    try {
      const res = await fetch('/api/leave');
      if (res.ok) {
        const data = await res.json();
        setUserDetails(data);
        try {
          localStorage.setItem("aquacon_cached_userdetails", JSON.stringify(data));
        } catch (e) {}
      }
    } catch (e) {
      // Restore from cache if offline
      try {
        const cached = localStorage.getItem("aquacon_cached_userdetails");
        if (cached) setUserDetails(JSON.parse(cached));
      } catch (err) {}
    }
  };

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const getCurrentTimeStr = () => {
    const d = new Date();
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const saveLocalDraft = (newLoc?: string, newTravel?: string, newPause?: string) => {
    try {
      const today = getTodayStr();
      const draft = {
        date: today,
        location: newLoc !== undefined ? newLoc : location,
        travel: newTravel !== undefined ? newTravel : travel,
        pause: newPause !== undefined ? newPause : pause,
      };
      localStorage.setItem("aquacon_today_draft", JSON.stringify(draft));
    } catch (e) {}
  };

  const fetchEntry = async () => {
    try {
      const res = await fetch('/api/time');
      if (res.ok) {
        const data = await res.json();
        if (data && !data.isDraft) {
          setEntry(data);
          setPause(data.pauseHours?.toString() || "0.5");
          setTravel(data.travelHours?.toString() || "0");
          setLocation(data.location || "");
          try {
            localStorage.setItem("aquacon_today_entry", JSON.stringify(data));
          } catch (e) {}
        } else {
          setEntry(null);
          let draftRestored = false;
          try {
            const savedDraft = localStorage.getItem("aquacon_today_draft");
            if (savedDraft) {
              const parsed = JSON.parse(savedDraft);
              if (parsed.date === getTodayStr()) {
                if (parsed.location !== undefined) setLocation(parsed.location);
                if (parsed.travel !== undefined) setTravel(parsed.travel);
                if (parsed.pause !== undefined) setPause(parsed.pause);
                draftRestored = true;
              }
            }
          } catch (e) {}

          if (!draftRestored && data && data.isDraft) {
            setLocation(data.location || "");
            setTravel("0");
            setPause("0.5");
          }
        }
      }
    } catch (e) {
      // If network fails / offline, restore cached entry for today if available
      try {
        const cached = localStorage.getItem("aquacon_today_entry");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.date === getTodayStr()) {
            setEntry(parsed);
            setPause(parsed.pauseHours?.toString() || "0.5");
            setTravel(parsed.travelHours?.toString() || "0");
            setLocation(parsed.location || "");
          }
        }
      } catch (err) {}
    } finally {
      setLoading(false);
    }
  };

  const isReminderDay = [1, 4, 5].includes(new Date().getDay());

  const checkFahrzeitReminder = (travelVal: string) => {
    if (isReminderDay) {
      const val = parseFloat(travelVal);
      if (isNaN(val) || val === 0) {
        return confirm(t('fahrzeitConfirm'));
      }
    }
    return true;
  };

  const handleSaveInputs = async () => {
    saveLocalDraft(location, travel, pause);
    if (!checkFahrzeitReminder(travel)) return;

    if (!navigator.onLine) {
      if (entry) {
        const offlineEntry = {
          ...entry,
          pauseHours: parseFloat(pause) || 0.5,
          travelHours: parseFloat(travel) || 0,
          location,
        };
        setEntry(offlineEntry);
        try {
          localStorage.setItem("aquacon_today_entry", JSON.stringify(offlineEntry));
        } catch (e) {}
        queueAction({ type: 'time', endpoint: '/api/time', method: 'POST', payload: { action: 'update', id: entry.id, pauseHours: pause, travelHours: travel, location } });
      }
      alert(t('offlineSaved') || "Offline gespeichert!");
      return;
    }

    if (entry) {
      try {
        const res = await fetch('/api/time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', id: entry.id, pauseHours: pause, travelHours: travel, location })
        });
        if (res.ok) {
          const data = await res.json();
          setEntry(data);
          try {
            localStorage.setItem("aquacon_today_entry", JSON.stringify(data));
          } catch (e) {}
          setRefreshCal(prev => prev + 1);
          alert(t('successApplied') || "Erfolgreich gespeichert!");
        } else {
          alert("Fehler beim Speichern");
        }
      } catch (e) {
        queueAction({ type: 'time', endpoint: '/api/time', method: 'POST', payload: { action: 'update', id: entry.id, pauseHours: pause, travelHours: travel, location } });
        alert(t('offlineSaved') || "Offline gespeichert!");
      }
    } else {
      alert(t('successApplied') || "Erfolgreich gespeichert!");
    }
  };

  const handleAction = async (action: 'start' | 'stop') => {
    if (action === 'stop' && !checkFahrzeitReminder(travel)) return;
    const payload = { action, pauseHours: pause, travelHours: travel, location };

    if (!navigator.onLine) {
      const now = getCurrentTimeStr();
      const today = getTodayStr();
      if (action === 'start') {
        const offlineEntry = {
          id: `offline-${Date.now()}`,
          date: today,
          startTime: now,
          endTime: null,
          pauseHours: parseFloat(pause) || 0.5,
          travelHours: parseFloat(travel) || 0,
          location: location || "",
          totalHours: null,
          isOffline: true,
        };
        setEntry(offlineEntry);
        try {
          localStorage.setItem("aquacon_today_entry", JSON.stringify(offlineEntry));
        } catch (e) {}
      } else {
        if (entry) {
          const startParts = (entry.startTime || now).split(':');
          const stopParts = now.split(':');
          const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
          const stopMins = parseInt(stopParts[0]) * 60 + parseInt(stopParts[1]);
          let diffMins = stopMins - startMins;
          if (diffMins < 0) diffMins += 24 * 60;
          const diffHours = diffMins / 60;
          const finalPause = parseFloat(pause) || 0;
          const finalTravel = parseFloat(travel) || 0;
          const totalHours = parseFloat(Math.max(0, diffHours - finalPause - finalTravel).toFixed(2));

          const offlineEntry = {
            ...entry,
            endTime: now,
            pauseHours: finalPause,
            travelHours: finalTravel,
            location,
            totalHours,
            isOffline: true,
          };
          setEntry(offlineEntry);
          try {
            localStorage.setItem("aquacon_today_entry", JSON.stringify(offlineEntry));
          } catch (e) {}
        }
      }
      queueAction({ type: 'time', endpoint: '/api/time', method: 'POST', payload });
      alert(t('offlineSaved') || "Offline gespeichert!");
      return;
    }

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
        if (data) {
          setPause(data.pauseHours?.toString() || "0.5");
          setTravel(data.travelHours?.toString() || "0");
          setLocation(data.location || "");
          try {
            localStorage.setItem("aquacon_today_entry", JSON.stringify(data));
          } catch (e) {}
        }
        setRefreshCal(prev => prev + 1);
      } else {
        const err = await res.json();
        alert(err.error || "Ein Fehler ist aufgetreten");
      }
    } catch (e) {
      queueAction({ type: 'time', endpoint: '/api/time', method: 'POST', payload });
      alert(t('offlineSaved') || "Offline gespeichert!");
    }
  };

  const openEditMode = () => {
    setEditStart(entry?.startTime || "");
    setEditEnd(entry?.endTime || "");
    setEditPause(entry?.pauseHours?.toString() || "0.5");
    setEditTravel(entry?.travelHours?.toString() || "0");
    setEditLocation(entry?.location || "");
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!checkFahrzeitReminder(editTravel)) return;
    const payload = { 
      action: 'update', 
      startTime: editStart,
      endTime: editEnd,
      pauseHours: editPause, 
      travelHours: editTravel, 
      location: editLocation 
    };

    if (!navigator.onLine) {
      if (entry) {
        const updated = {
          ...entry,
          startTime: editStart,
          endTime: editEnd,
          pauseHours: parseFloat(editPause) || 0,
          travelHours: parseFloat(editTravel) || 0,
          location: editLocation,
        };
        setEntry(updated);
        try {
          localStorage.setItem("aquacon_today_entry", JSON.stringify(updated));
        } catch (e) {}
        queueAction({ type: 'time', endpoint: '/api/time', method: 'POST', payload });
      }
      setIsEditing(false);
      alert(t('offlineSaved') || "Offline gespeichert!");
      return;
    }

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
        if (data) {
          setPause(data.pauseHours?.toString() || "0.5");
          setTravel(data.travelHours?.toString() || "0");
          setLocation(data.location || "");
          try {
            localStorage.setItem("aquacon_today_entry", JSON.stringify(data));
          } catch (e) {}
        }
        setIsEditing(false);
        setRefreshCal(prev => prev + 1);
      } else {
        const err = await res.json();
        alert(err.error || "Fehler beim Speichern");
      }
    } catch (e) {
      queueAction({ type: 'time', endpoint: '/api/time', method: 'POST', payload });
      setIsEditing(false);
      alert(t('offlineSaved') || "Offline gespeichert!");
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { type: leaveType, startDate: leaveStart, endDate: leaveEnd };

    if (!navigator.onLine) {
      queueAction({ type: 'leave', endpoint: '/api/leave', method: 'POST', payload });
      alert(t('offlineSaved') || "Offline gespeichert (Wird bei Verbindung synchronisiert)");
      setLeaveStart("");
      setLeaveEnd("");
      return;
    }

    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert(t('successApplied'));
        setLeaveStart("");
        setLeaveEnd("");
        fetchUserDetails();
        setRefreshCal(prev => prev + 1);
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      queueAction({ type: 'leave', endpoint: '/api/leave', method: 'POST', payload });
      alert(t('offlineSaved') || "Offline gespeichert (Wird bei Verbindung synchronisiert)");
      setLeaveStart("");
      setLeaveEnd("");
    }
  };

  const handleDeleteLeave = async (id: number) => {
    if (!confirm(t('delete') + "?")) return;
    const res = await fetch(`/api/leave/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchUserDetails();
      setRefreshCal(prev => prev + 1);
    }
  };

  if (loading || status === "loading") {
    return <div className="flex items-center justify-center min-h-screen text-slate-500 font-medium">Laden...</div>;
  }

  const isWorking = entry?.startTime && !entry?.endTime;
  const isFinished = entry?.startTime && entry?.endTime;

  return (
    <>
      <Header />
      <main className="p-4 sm:p-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 gap-2 w-full">
          <h1 className="text-2xl sm:text-3xl font-bold text-left">{t('hello')}, <span className="text-blue-600">{session?.user?.name}</span></h1>
          <div className="flex items-center gap-4">
            {(session?.user as any)?.role === 'ADMIN' && (
              <button 
                onClick={() => router.push("/admin")}
                className="bg-purple-600 text-white px-3 py-1 rounded font-bold"
              >
                {t('adminPanel')}
              </button>
            )}
            <button 
              onClick={() => signOut()}
              className="bg-red-500 text-white px-3 py-1 rounded font-bold"
            >
              {t('logout')}
            </button>
          </div>
        </div>

        <div className="bg-white shadow p-4 sm:p-6 rounded mb-8 border-t-4 border-blue-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold">{t('timeTrackerToday')}</h2>
            {elapsedTime && (
              <div className="bg-green-100 text-green-800 font-mono px-3 py-1 rounded-md shadow-inner text-lg border border-green-300">
                ⏱️ {t('workingTime')}: {elapsedTime}
              </div>
            )}
          </div>
          
          {!isEditing ? (
            <>
              <div className="flex flex-wrap gap-4 items-center">
                <button 
                  onClick={() => handleAction('start')}
                  disabled={isWorking}
                  className={`px-6 py-2 rounded font-bold text-lg ${isWorking ? 'bg-gray-300 text-gray-500' : 'bg-green-500 text-white hover:bg-green-600'}`}
                >
                  {t('start')}
                </button>
                <button 
                  onClick={() => handleAction('stop')}
                  disabled={!isWorking}
                  className={`px-6 py-2 rounded font-bold text-lg ${!isWorking ? 'bg-gray-300 text-gray-500' : 'bg-red-500 text-white hover:bg-red-600'}`}
                >
                  {t('stop')}
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('pause')}</label>
                  <input 
                    type="number" 
                    value={pause}
                    onChange={e => {
                      setPause(e.target.value);
                      saveLocalDraft(location, travel, e.target.value);
                    }}
                    step="0.5" 
                    className="border p-2 rounded w-32" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('travel')}</label>
                  <input 
                    type="number" 
                    value={travel}
                    onChange={e => {
                      setTravel(e.target.value);
                      saveLocalDraft(location, e.target.value, pause);
                    }}
                    step="0.5" 
                    className={`border p-2 rounded w-32 ${isReminderDay ? 'border-orange-500 bg-orange-50' : ''}`} 
                  />
                  {isReminderDay && (
                    <p className="text-orange-600 text-xs font-bold mt-1 w-32 leading-tight">
                      {t('fahrzeitReminder')}
                    </p>
                  )}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-semibold mb-1">{t('location')}</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={e => {
                      setLocation(e.target.value);
                      saveLocalDraft(e.target.value, travel, pause);
                    }}
                    placeholder="..."
                    className="border p-2 rounded w-full" 
                  />
                </div>
                <div>
                  <button 
                    type="button"
                    onClick={handleSaveInputs}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded border">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold mb-2">{t('status')}</h3>
                    <p>{t('startTime')}: {entry?.startTime || '-'}</p>
                    <p>{t('endTime')}: {entry?.endTime || '-'}</p>
                    <p>{t('location')}: {entry?.location || '-'}</p>
                    {isFinished && (
                      <p className="mt-2 text-lg font-bold text-blue-600">
                        {t('totalHours')}: {entry?.totalHours} h
                      </p>
                    )}
                  </div>
                  {isFinished && (
                    <button 
                      onClick={openEditMode}
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm font-semibold"
                    >
                      {t('edit')}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
              <h3 className="font-bold mb-4">{t('edit')}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold">{t('startTime')} (HH:MM)</label>
                  <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-semibold">{t('endTime')} (HH:MM)</label>
                  <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-semibold">{t('pause')}</label>
                  <input type="number" step="0.5" value={editPause} onChange={e => setEditPause(e.target.value)} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-sm font-semibold">{t('travel')}</label>
                  <input type="number" step="0.5" value={editTravel} onChange={e => setEditTravel(e.target.value)} className="border p-2 rounded w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold">{t('location')}</label>
                  <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} className="border p-2 rounded w-full" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleUpdate} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">
                  {t('save')}
                </button>
                <button onClick={() => setIsEditing(false)} className="bg-gray-400 text-white px-4 py-2 rounded font-bold">
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Abwesenheiten Section */}
        <div className="bg-white shadow p-4 sm:p-6 rounded mb-8 border-t-4 border-yellow-400">
          <h2 className="text-xl font-bold mb-4">{t('absencesTitle')}</h2>
          
          {userDetails && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="block text-xs sm:text-sm text-gray-500 font-medium">{t('annualLeave')}</span>
                <span className="font-bold text-base sm:text-lg text-gray-900">{userDetails.annualLeaveDays} {t('days')}</span>
              </div>
              <div>
                <span className="block text-xs sm:text-sm text-gray-500 font-medium">{t('lastYearRest')}</span>
                <span className="font-bold text-base sm:text-lg text-green-600">{userDetails.carriedOverLeaveDays} {t('days')}</span>
              </div>
              {/* Calculate used approved vacation for current year */}
              {(() => {
                const used = userDetails.leaveRequests
                  ?.filter((l: any) => l.type === 'URLAUB' && l.status === 'APPROVED' && new Date(l.createdAt).getFullYear() === new Date().getFullYear())
                  .reduce((sum: number, l: any) => sum + l.daysCount, 0) || 0;
                const rest = (userDetails.annualLeaveDays || 0) + (userDetails.carriedOverLeaveDays || 0) - used;
                return (
                  <div>
                    <span className="block text-xs sm:text-sm text-gray-500 font-medium">{t('currentRest')}</span>
                    <span className="font-bold text-base sm:text-lg text-blue-600">{rest} {t('days')}</span>
                  </div>
                );
              })()}
              <div className="border-l border-gray-200 pl-4 bg-blue-50/60 -my-2 -mr-2 p-2 rounded-r-lg">
                <span className="block text-xs sm:text-sm text-blue-900 font-bold">⏱️ {t('bestandZeitkonto')}</span>
                <span className="font-extrabold text-base sm:text-lg text-indigo-700">
                  {userDetails.zeitkonto?.currentBalance?.toFixed(1) || "0.0"} <span className="text-xs font-semibold text-gray-500">/ 200 h</span>
                </span>
                <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((userDetails.zeitkonto?.currentBalance || 0) / 200) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLeaveSubmit} className="flex flex-wrap gap-4 items-end mb-8">
            <div>
              <label className="block text-sm font-semibold mb-1">{t('type')}</label>
              <select 
                value={leaveType} 
                onChange={e => setLeaveType(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="URLAUB">{t('vacation')}</option>
                <option value="KRANK">{t('sick')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('fromStart')}</label>
              <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} required className="border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('toEnd')}</label>
              <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} required className="border p-2 rounded" />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm">
              {t('apply')}
            </button>
          </form>

          <div>
            <h3 className="font-bold mb-3 text-gray-900">{t('myRequests')}</h3>
            {userDetails?.leaveRequests?.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('noRequestsLeave')}</p>
            ) : (
              <ul className="space-y-2">
                {userDetails?.leaveRequests?.map((req: any) => {
                  const formatDbDate = (d: string) => {
                    const p = d?.split('-');
                    return p?.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
                  };
                  return (
                    <li key={req.id} className="p-3 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50">
                      <div className="text-sm">
                        <span className="font-bold mr-2 text-gray-900">
                          {req.type === 'URLAUB' ? `🏖️ ${t('vacation')}` : `🤒 ${t('sick')}`}
                        </span>
                        <span className="text-gray-700">{formatDbDate(req.startDate)} {t('to')} {formatDbDate(req.endDate)}</span>
                        <span className="ml-2 text-xs text-gray-500 font-medium">({req.daysCount} {t('days')})</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        {req.status === 'PENDING' && <span className="bg-yellow-100 text-yellow-800 px-2.5 py-0.5 rounded-full text-xs font-bold">{t('waitingForAdmin')}</span>}
                        {req.status === 'APPROVED' && <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-xs font-bold">{t('approved')}</span>}
                        {req.status === 'REJECTED' && <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-xs font-bold">{t('rejected')}</span>}
                        <button onClick={() => handleDeleteLeave(req.id)} className="text-red-500 hover:text-red-700 font-bold ml-2 text-xs">
                          {t('delete')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <CalendarAndExport
          userName={session?.user?.name || "Mitarbeiter"}
          fullName={workerDisplayName({
            firstName: userDetails?.firstName,
            lastName: userDetails?.lastName,
            username: session?.user?.name,
          })}
          refreshTrigger={refreshCal}
        />
      </main>
    </>
  );
}
