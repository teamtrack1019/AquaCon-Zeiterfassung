"use client";
import { useSession, signOut } from "next-auth/react";
import Header from "@/components/Header";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userEntries, setUserEntries] = useState<any[]>([]);
  
  const [adminNewPassword, setAdminNewPassword] = useState("");

  const [annualLeaveDays, setAnnualLeaveDays] = useState("30");
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [showLeavesModal, setShowLeavesModal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if ((session?.user as any)?.role && (session?.user as any)?.role !== 'ADMIN') {
      router.push("/dashboard");
    } else if (status === "authenticated" && (session?.user as any)?.role === 'ADMIN') {
      fetchUsers();
      fetchPendingLeaves();
    }
  }, [status, session, router]);

  const fetchPendingLeaves = async () => {
    const res = await fetch('/api/admin/leave/pending');
    if (res.ok) {
      setPendingLeaves(await res.json());
    }
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
      // Update selectedUser safely via functional update
      setSelectedUser((prev: any) => {
        if (!prev) return prev;
        const updated = data.find((u: any) => u.id === prev.id);
        return updated || prev;
      });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 3) return alert("Passwort zu kurz");
    
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, password: newPassword, annualLeaveDays })
    });

    if (res.ok) {
      setNewUsername("");
      setNewPassword("");
      setAnnualLeaveDays("30");
      fetchUsers();
      alert("Mitarbeiter erfolgreich erstellt!");
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleLeaveAction = async (id: number, newStatus: string) => {
    const res = await fetch(`/api/admin/leave/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      fetchPendingLeaves();
      fetchUsers(); // This will automatically update selectedUser via the logic in fetchUsers
    }
  };

  const viewUserEntries = async (user: any) => {
    setSelectedUser(user);
    const res = await fetch(`/api/admin/entries/${user.id}`);
    if (res.ok) {
      const data = await res.json();
      setUserEntries(data);
    }
  };

  const deleteUser = async (userId: number, username: string) => {
    if (!confirm(`MÃ¶chten Sie den Mitarbeiter '${username}' wirklich lÃ¶schen? Alle seine ZeiteintrÃ¤ge werden ebenfalls gelÃ¶scht.`)) return;
    
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      if (selectedUser?.id === userId) setSelectedUser(null);
      fetchUsers();
    }
  };

  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("MÃ¶chten Sie Ihr Admin-Passwort wirklich Ã¤ndern?")) return;
    
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: adminNewPassword })
    });

    if (res.ok) {
      alert("Passwort erfolgreich geÃ¤ndert!");
      setAdminNewPassword("");
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const changeWorkerPassword = async (userId: number, username: string) => {
    const newPassword = prompt(`Neues Passwort (PIN) fÃ¼r '${username}' eingeben:`);
    if (!newPassword) return;
    
    if (newPassword.length < 3) {
      alert("Das Passwort muss mindestens 3 Zeichen lang sein.");
      return;
    }
    
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    
    if (res.ok) {
      alert(`Passwort fÃ¼r '${username}' erfolgreich geÃ¤ndert!`);
    } else {
      const err = await res.json();
      alert(err.error || "Fehler beim Ã„ndern des Passworts");
    }
  };

  const changeWorkerLeave = async (userId: number, username: string, currentDays: number) => {
    const newVal = prompt(`Jahresurlaub fÃ¼r '${username}' Ã¤ndern:`, currentDays.toString());
    if (newVal === null) return;
    
    const parsed = parseInt(newVal);
    if (isNaN(parsed) || parsed < 0) return alert("UngÃ¼ltige Anzahl");

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annualLeaveDays: parsed })
    });
    
    if (res.ok) {
      fetchUsers();
    } else {
      alert("Fehler beim Speichern");
    }
  };

  const changeWorkerCarriedLeave = async (userId: number, username: string, currentDays: number) => {
    const newVal = prompt(`${t('lastYearRest')} fÃ¼r '${username}' ${t('change')}:`, currentDays.toString());
    if (newVal === null) return;
    
    const parsed = parseInt(newVal);
    if (isNaN(parsed) || parsed < 0) return alert("UngÃ¼ltige Anzahl");

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carriedOverLeaveDays: parsed })
    });
    
    if (res.ok) {
      fetchUsers();
    } else {
      alert("Fehler beim Speichern");
    }
  };

  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const dayName = d.toLocaleDateString('de-DE', { weekday: 'long' });
      return `${parts[2]}.${parts[1]}.${parts[0]} (${dayName})`;
    }
    return dateStr;
  };

  const generateAdminPDF = () => {
    if (!selectedUser || userEntries.length === 0) return;
    
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("aquaCon Zeiterfassung", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Mitarbeiter: ${selectedUser.username}`, 14, 30);
    const currentDate = new Date().toLocaleDateString('de-DE');
    doc.text(`Erstelldatum: ${currentDate}`, 14, 36);

    const tableColumn = ["Datum", "Ort", "Start", "Ende", "Pause (h)", "Fahrzeit (h)", "Gesamt (h)"];
    const tableRows: any[] = [];
    
    let totalMonthHours = 0;

    userEntries.forEach(entry => {
      const entryData = [
        formatDateWithDay(entry.date),
        entry.location || "-",
        entry.startTime || "-",
        entry.endTime || "-",
        entry.pauseHours?.toString() || "0",
        entry.travelHours?.toString() || "0",
        entry.totalHours ? entry.totalHours.toString() : "-"
      ];
      tableRows.push(entryData);
      
      if (entry.totalHours) {
        totalMonthHours += entry.totalHours;
      }
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
    });

    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(12);
    doc.text(`Gesamte Arbeitsstunden: ${totalMonthHours.toFixed(2)} h`, 14, finalY + 10);

    doc.save(`aquaCon_Zeiterfassung_${selectedUser.username}.pdf`);
  };

  if (status === "loading" || (status === "authenticated" && (session?.user as any)?.role !== 'ADMIN')) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Header />
      <main className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 gap-2 w-full">
          <h1 className="text-xl sm:text-3xl font-bold">{t('adminTitle')}</h1>
          <div className="flex items-center gap-4">
            {/* Notification Bell for Pending Leaves */}
            <div className="relative">
              <button 
                onClick={() => setShowLeavesModal(!showLeavesModal)}
                className="text-2xl relative focus:outline-none"
              >
                ðŸ””
                {pendingLeaves.length > 0 && (
                  <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {pendingLeaves.length}
                  </span>
                )}
              </button>

              {showLeavesModal && (
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-10">
                  <div className="p-3 border-b bg-gray-50 font-bold text-gray-700">
                    {t('pendingLeaves')}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {pendingLeaves.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">{t('noNewLeaves')}</div>
                    ) : (
                      <ul className="divide-y">
                        {pendingLeaves.map(leave => {
                          const formatDbDate = (d: string) => {
                            const p = d?.split('-');
                            return p?.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
                          };
                          return (
                            <li key={leave.id} className="p-4">
                              <div className="mb-2">
                                <span className="font-bold text-blue-600">{leave.user?.username}</span> {t('requestsLeave')}
                                <br/>
                                <span className="text-sm">{formatDbDate(leave.startDate)} {t('to')} {formatDbDate(leave.endDate)} ({leave.daysCount} {t('days')})</span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleLeaveAction(leave.id, 'APPROVED')} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold flex-1">{t('approve')}</button>
                                <button onClick={() => handleLeaveAction(leave.id, 'REJECTED')} className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold flex-1">{t('decline')}</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            <span>Admin: {session?.user?.name}</span>
            <button onClick={() => signOut()} className="bg-red-500 text-white px-4 py-2 rounded">
              {t('logout')}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 space-y-8">
            <div className="bg-white shadow p-6 rounded border-t-4 border-blue-500">
              <h2 className="text-xl font-bold mb-4">{t('newWorker')}</h2>
              <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('username')}</label>
                  <input 
                    type="text" 
                    value={newUsername}
                    onChange={e => {
                      const val = e.target.value;
                      if(val.length > 0) {
                        setNewUsername(val.charAt(0).toUpperCase() + val.slice(1));
                      } else {
                        setNewUsername(val);
                      }
                    }}
                    className="border w-full p-2 rounded" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('passwordPin')}</label>
                  <input 
                    type="text" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="border w-full p-2 rounded" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('annualLeaveDaysLabel')}</label>
                  <input 
                    type="number" 
                    value={annualLeaveDays}
                    onChange={e => setAnnualLeaveDays(e.target.value)}
                    className="border w-full p-2 rounded" 
                    required
                  />
                </div>
                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-bold">
                  {t('saveBtn')}
                </button>
              </form>
            </div>
            
            <div className="bg-white shadow p-6 rounded border-t-4 border-gray-500">
              <h2 className="text-xl font-bold mb-4">{t('changeMyPassword')}</h2>
              <form onSubmit={handleAdminPasswordChange} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t('newPassword')}</label>
                  <input 
                    type="password" 
                    value={adminNewPassword}
                    onChange={e => setAdminNewPassword(e.target.value)}
                    className="border w-full p-2 rounded" 
                    placeholder={t('min3Chars')}
                    required
                  />
                </div>
                <button type="submit" className="bg-gray-700 text-white p-2 rounded hover:bg-gray-800 font-bold">
                  {t('updatePassword')}
                </button>
              </form>
            </div>

            <div className="bg-white shadow p-6 rounded">
              <h2 className="text-xl font-bold mb-4">{t('workerList')}</h2>
              <ul className="space-y-3">
                {users.map(u => (
                  <li key={u.id} className="border-b pb-3 flex flex-wrap justify-between items-center gap-2">
                    <div className="flex flex-col mr-2">
                      <span className="font-semibold text-lg">{u.username}</span>
                      <span className="text-xs text-gray-500 font-mono">
                        {u.password?.startsWith('$2') ? 'VerschlÃ¼sselt (Bitte Passwort neu vergeben)' : `PIN: ${u.password}`}
                      </span>
                    </div>
                    {u.role !== 'ADMIN' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => viewUserEntries(u)}
                          className="bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 text-sm font-semibold"
                        >
                          {t('times')}
                        </button>
                        <button 
                          onClick={() => changeWorkerPassword(u.id, u.username)}
                          className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200 text-sm font-semibold"
                        >
                          {t('password')}
                        </button>
                        <button 
                          onClick={() => deleteUser(u.id, u.username)}
                          className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 text-sm font-semibold"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="w-full md:w-2/3">
            {selectedUser ? (
              <div className="bg-white shadow p-6 rounded h-full border-t-4 border-green-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">{t('timesOf')} <span className="text-blue-600">{selectedUser.username}</span></h2>
                  <button onClick={generateAdminPDF} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">
                    {t('exportPdf')}
                  </button>
                </div>

                {/* Show Leave Balances */}
                <div className="flex flex-wrap gap-8 mb-6 p-4 bg-gray-50 rounded border">
                  <div>
                    <span className="block text-sm text-gray-500">{t('annualLeave')}</span>
                    <span className="font-bold text-lg">{selectedUser.annualLeaveDays} {t('days')}</span>
                    <button 
                      onClick={() => changeWorkerLeave(selectedUser.id, selectedUser.username, selectedUser.annualLeaveDays)}
                      className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                      {t('change')}
                    </button>
                  </div>
                  <div>
                    <span className="block text-sm text-gray-500">{t('lastYearRest')}</span>
                    <span className="font-bold text-lg text-green-600">{selectedUser.carriedOverLeaveDays} {t('days')}</span>
                    <button 
                      onClick={() => changeWorkerCarriedLeave(selectedUser.id, selectedUser.username, selectedUser.carriedOverLeaveDays)}
                      className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                    >
                      {t('change')}
                    </button>
                  </div>
                  {(() => {
                    const used = selectedUser.leaveRequests
                      ?.filter((l: any) => l.type === 'URLAUB' && new Date(l.createdAt).getFullYear() === new Date().getFullYear())
                      .reduce((sum: number, l: any) => sum + l.daysCount, 0) || 0;
                    const rest = selectedUser.annualLeaveDays + selectedUser.carriedOverLeaveDays - used;
                    return (
                      <div>
                        <span className="block text-sm text-gray-500">{t('currentRest')}</span>
                        <span className="font-bold text-lg text-blue-600">{rest} {t('days')}</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 border-b">{t('date')}</th>
                        <th className="p-3 border-b">{t('ort')}</th>
                        <th className="p-3 border-b">{t('start')}</th>
                        <th className="p-3 border-b">{t('endTime')}</th>
                        <th className="p-3 border-b">{t('pause')}</th>
                        <th className="p-3 border-b">{t('travel')}</th>
                        <th className="p-3 border-b">{t('totalH')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userEntries.length === 0 ? (
                        <tr><td colSpan={7} className="p-4 text-center text-gray-500">{t('noTimesYet')}</td></tr>
                      ) : (
                        userEntries.map((e: any) => (
                          <tr key={e.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{formatDateWithDay(e.date)}</td>
                            <td className="p-3 max-w-[150px] break-words">{e.location || '-'}</td>
                            <td className="p-3">{e.startTime || '-'}</td>
                            <td className="p-3">{e.endTime || '-'}</td>
                            <td className="p-3">{e.pauseHours}</td>
                            <td className="p-3">{e.travelHours}</td>
                            <td className="p-3 font-bold text-blue-600">
                              {e.totalHours ? e.totalHours.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {userEntries.length > 0 && (
                      <tfoot className="bg-blue-50">
                        <tr>
                          <td colSpan={6} className="p-3 text-right font-bold">{t('totalHoursLabel')}</td>
                          <td className="p-3 font-bold text-blue-700">
                            {userEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0).toFixed(2)} h
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Show Leave Requests for this user */}
                {selectedUser.leaveRequests && selectedUser.leaveRequests.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-bold mb-4">{t('absencesTitle')}</h3>
                    <ul className="space-y-2">
                      {selectedUser.leaveRequests.map((req: any) => {
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
                            <div>
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-bold">{t('approved')}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-12 text-center text-gray-500 h-full flex items-center justify-center">
                {t('selectWorker')}
              </div>
            )}
          </div>
        </div>

      </main>
    </>
  );
}



