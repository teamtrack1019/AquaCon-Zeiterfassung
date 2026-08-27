"use client";
import { useSession, signOut } from "next-auth/react";
import Header from "@/components/Header";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CalendarAndExport from "@/components/CalendarAndExport";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
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
        if (diffMins < 0) diffMins += 24 * 60; // Gece yarÄ±sÄ±nÄ± geÃ§erse
        
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

  const fetchUserDetails = async () => {
    const res = await fetch('/api/leave');
    if (res.ok) {
      setUserDetails(await res.json());
    }
  };

  const fetchEntry = async () => {
    try {
      const res = await fetch('/api/time');
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
        if (data) {
          setPause(data.pauseHours?.toString() || "0.5");
          setTravel(data.travelHours?.toString() || "0");
          setLocation(data.location || "");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'start' | 'stop') => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pauseHours: pause, travelHours: travel, location })
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
        if (data) {
          setPause(data.pauseHours?.toString() || "0.5");
          setTravel(data.travelHours?.toString() || "0");
          setLocation(data.location || "");
        }
        setRefreshCal(prev => prev + 1);
      } else {
        const err = await res.json();
        alert(err.error || "Ein Fehler ist aufgetreten");
      }
    } catch (e) {
      console.error(e);
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
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update', 
          startTime: editStart,
          endTime: editEnd,
          pauseHours: editPause, 
          travelHours: editTravel, 
          location: editLocation 
        })
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data);
        if (data) {
          setPause(data.pauseHours?.toString() || "0.5");
          setTravel(data.travelHours?.toString() || "0");
          setLocation(data.location || "");
        }
        setIsEditing(false);
        setRefreshCal(prev => prev + 1);
      } else {
        const err = await res.json();
        alert(err.error || "Fehler beim Speichern");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: leaveType, startDate: leaveStart, endDate: leaveEnd })
    });
    
    if (res.ok) {
      alert(t('successApplied'));
      setLeaveStart("");
      setLeaveEnd("");
      fetchUserDetails();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleDeleteLeave = async (id: number) => {
    if (!confirm(t('delete') + "?")) return;
    const res = await fetch(`/api/leave/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchUserDetails();
    }
  };

  if (loading || status === "loading") {
    return <div>Loading...</div>;
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
                &#9201; {t('workingTime')}: {elapsedTime}
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

              <div className="mt-6 flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('pause')}</label>
                  <input 
                    type="number" 
                    value={pause}
                    onChange={e => setPause(e.target.value)}
                    step="0.5" 
                    className="border p-2 rounded w-32" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('travel')}</label>
                  <input 
                    type="number" 
                    value={travel}
                    onChange={e => setTravel(e.target.value)}
                    step="0.5" 
                    className="border p-2 rounded w-32" 
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-semibold mb-1">{t('location')}</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="..."
                    className="border p-2 rounded w-full" 
                  />
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
            <div className="flex gap-6 mb-6 p-4 bg-gray-50 rounded border">
              <div>
                <span className="block text-sm text-gray-500">{t('annualLeave')}</span>
                <span className="font-bold text-lg">{userDetails.annualLeaveDays} {t('days')}</span>
              </div>
              <div>
                <span className="block text-sm text-gray-500">{t('lastYearRest')}</span>
                <span className="font-bold text-lg text-green-600">{userDetails.carriedOverLeaveDays} {t('days')}</span>
              </div>
              {/* Calculate used approved vacation for current year */}
              {(() => {
                const used = userDetails.leaveRequests
                  .filter((l: any) => l.type === 'URLAUB' && l.status === 'APPROVED' && new Date(l.createdAt).getFullYear() === new Date().getFullYear())
                  .reduce((sum: number, l: any) => sum + l.daysCount, 0);
                const rest = userDetails.annualLeaveDays + userDetails.carriedOverLeaveDays - used;
                return (
                  <div>
                    <span className="block text-sm text-gray-500">{t('currentRest')}</span>
                    <span className="font-bold text-lg text-blue-600">{rest} {t('days')}</span>
                  </div>
                );
              })()}
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
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">
              {t('apply')}
            </button>
          </form>

          <div>
            <h3 className="font-bold mb-3">{t('myRequests')}</h3>
            {userDetails?.leaveRequests.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('noRequestsLeave')}</p>
            ) : (
              <ul className="space-y-2">
                {userDetails?.leaveRequests.map((req: any) => {
                  const formatDbDate = (d: string) => {
                    const p = d?.split('-');
                    return p?.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
                  };
                  return (
                    <li key={req.id} className="p-3 border rounded flex justify-between items-center bg-gray-50">
                      <div>
                        <span className="font-bold mr-2">{req.type === 'URLAUB' ? `ðŸ– ${t('vacation')}` : `ðŸ¤’ ${t('sick')}`}</span>
                        <span className="text-gray-700">{formatDbDate(req.startDate)} {t('to')} {formatDbDate(req.endDate)}</span>
                        <span className="ml-2 text-sm text-gray-500">({req.daysCount} {t('days')})</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        {req.status === 'PENDING' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-bold">{t('waitingForAdmin')}</span>}
                        {req.status === 'APPROVED' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-bold">{t('approved')}</span>}
                        {req.status === 'REJECTED' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-bold">{t('rejected')}</span>}
                        <button onClick={() => handleDeleteLeave(req.id)} className="text-red-500 hover:text-red-700 font-bold ml-2 text-sm">
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

        <CalendarAndExport userName={session?.user?.name || "Mitarbeiter"} refreshTrigger={refreshCal} />
      </main>
    </>
  );
}





