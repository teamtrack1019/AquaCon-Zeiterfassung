"use client";
import { useSession, signOut } from "next-auth/react";
import Header from "@/components/Header";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateZeitkonto } from "@/lib/zeitkonto";
import { AQUACON_LOGO_BASE64 } from "@/lib/logoBase64";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [workerEntryDate, setWorkerEntryDate] = useState("");
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userEntries, setUserEntries] = useState<any[]>([]);
  const [adminSelectedMonth, setAdminSelectedMonth] = useState("");
  
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [annualLeaveDays, setAnnualLeaveDays] = useState("30");
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [showLeavesModal, setShowLeavesModal] = useState(false);

  useEffect(() => {
    const now = new Date();
    setAdminSelectedMonth(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
  }, []);

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
      body: JSON.stringify({ username: newUsername, password: newPassword, annualLeaveDays, entryDate: workerEntryDate || null })
    });

    if (res.ok) {
      setNewUsername("");
      setNewPassword("");
      setAnnualLeaveDays("30");
      setWorkerEntryDate("");
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
    if (!confirm(`Möchten Sie den Mitarbeiter '${username}' wirklich löschen? Alle seine Zeiteinträge werden ebenfalls gelöscht.`)) return;
    
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
    if (!confirm("Möchten Sie Ihr Admin-Passwort wirklich ändern?")) return;
    
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: adminNewPassword })
    });

    if (res.ok) {
      alert("Passwort erfolgreich geändert!");
      setAdminNewPassword("");
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const changeWorkerPassword = async (userId: number, username: string) => {
    const newPassword = prompt(`Neues Passwort (PIN) für '${username}' eingeben:`);
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
      alert(`Passwort für '${username}' erfolgreich geändert!`);
    } else {
      const err = await res.json();
      alert(err.error || "Fehler beim Ändern des Passworts");
    }
  };

  const changeWorkerLeave = async (userId: number, username: string, currentDays: number) => {
    const newVal = prompt(`Jahresurlaub für '${username}' ändern (z.B. 12.5 oder 12,5):`, currentDays.toString());
    if (newVal === null) return;
    
    const parsed = parseFloat(newVal.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return alert("Ungültige Anzahl");

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
    const newVal = prompt(`${t('lastYearRest')} für '${username}' ${t('change')} (z.B. 2.5 oder 2,5):`, currentDays.toString());
    if (newVal === null) return;
    
    const parsed = parseFloat(newVal.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return alert("Ungültige Anzahl");

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

  const formatDbDate = (d?: string) => {
    if (!d) return "-";
    const p = d.split('-');
    return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
  };

  const formatMonthLabel = (ym: string) => {
    const parts = ym.split('-');
    return `${parts[1]}/${parts[0]}`;
  };

  const changeWorkerEntryDate = async (userId: number, username: string, currentEntryDate?: string) => {
    const newVal = prompt(`${t('entryDate')} für '${username}' ändern (z.B. 03.08.2026 oder 2026-08-03):`, currentEntryDate ? formatDbDate(currentEntryDate) : "");
    if (newVal === null) return;
    
    let formatted = newVal.trim();
    if (formatted.includes('.')) {
      const parts = formatted.split('.');
      if (parts.length === 3) {
        formatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    if (formatted && !/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return alert("Ungültiges Datumsformat. Bitte TT.MM.JJJJ oder JJJJ-MM-TT verwenden.");
    }

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryDate: formatted || null })
    });
    
    if (res.ok) {
      fetchUsers();
      const updatedUser = { ...selectedUser, entryDate: formatted || null };
      setSelectedUser(updatedUser);
      viewUserEntries(updatedUser);
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

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
    userEntries.forEach(e => {
      if (e.date) {
        set.add(e.date.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [userEntries]);

  const displayedUserEntries = useMemo(() => {
    return userEntries.filter(e => e.date && e.date.startsWith(adminSelectedMonth));
  }, [userEntries, adminSelectedMonth]);

  const adminZeitkontoData = useMemo(() => {
    return calculateZeitkonto(userEntries);
  }, [userEntries]);

  const currentAdminMonthZK = useMemo(() => {
    if (adminZeitkontoData.months[adminSelectedMonth]) {
      return adminZeitkontoData.months[adminSelectedMonth];
    }
    const gross = displayedUserEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    const availableCap = Math.max(0, 200 - adminZeitkontoData.currentBalance);
    const deduction = gross > 0 ? Math.min(5.0, availableCap) : 0;
    return {
      month: adminSelectedMonth,
      grossHours: parseFloat(gross.toFixed(2)),
      deduction: parseFloat(deduction.toFixed(2)),
      netHours: parseFloat(Math.max(0, gross - deduction).toFixed(2)),
      cumulativeBalance: parseFloat(Math.min(200, adminZeitkontoData.currentBalance + deduction).toFixed(2)),
    };
  }, [adminZeitkontoData, adminSelectedMonth, displayedUserEntries]);

  const generateAdminPDF = () => {
    if (!selectedUser || displayedUserEntries.length === 0) return;
    
    const doc = new jsPDF();
    
    // Logo (Top Right)
    try {
      doc.addImage(AQUACON_LOGO_BASE64, 'PNG', 170, 10, 26, 26);
    } catch (e) {}

    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 95, 168);
    doc.text("AquaCon Zeiterfassung", 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Mitarbeiter: ${selectedUser.username}`, 14, 28);
    const currentDate = new Date().toLocaleDateString('de-DE');
    doc.text(`Monat: ${formatMonthLabel(adminSelectedMonth)}  |  Erstelldatum: ${currentDate}`, 14, 35);
    doc.setTextColor(0, 0, 0);

    const tableColumn = ["Datum", "Ort", "Start", "Ende", "Pause (h)", "Fahrzeit (h)", "Gesamt (h)"];
    const tableRows: any[] = [];
    
    let totalMonthHours = 0;
    let totalTravelHours = 0;

    displayedUserEntries.forEach(entry => {
      let locationText = entry.location || "-";
      let startText = entry.startTime || "-";
      let endText = entry.endTime || "-";
      let pauseText = entry.pauseHours?.toString() || "0";
      let travelText = entry.travelHours?.toString() || "0";
      let totalText = entry.totalHours ? `${entry.totalHours.toString()} h` : "-";

      if (entry.isLeave) {
        locationText = entry.leaveType === 'URLAUB' ? t('vacation') : t('sick');
        startText = "-";
        endText = "-";
        pauseText = "0";
        travelText = "0";
        totalText = entry.leaveType === 'URLAUB' ? t('vacation') : t('sick');
      } else if (entry.isFeiertag && entry.isHolidayOff) {
        locationText = `Feiertag: ${entry.feiertagName}`;
        startText = "-";
        endText = "-";
        pauseText = "0";
        travelText = "0";
        totalText = "Feiertag";
      } else if (entry.isFeiertag && !entry.isHolidayOff) {
        locationText = `${entry.location || "-"} (Feiertag: ${entry.feiertagName})`;
        startText = entry.startTime || "-";
        endText = entry.endTime || "-";
        pauseText = entry.pauseHours?.toString() || "0";
        travelText = entry.travelHours?.toString() || "0";
        totalText = `${entry.totalHours ? entry.totalHours.toString() : "-"} h (Feiertag)`;
      }

      const entryData = [
        formatDateWithDay(entry.date),
        locationText,
        startText,
        endText,
        pauseText,
        travelText,
        totalText
      ];
      tableRows.push(entryData);
      
      if (entry.totalHours) {
        totalMonthHours += entry.totalHours;
      }
      if (entry.travelHours) {
        const tr = parseFloat(entry.travelHours);
        if (!isNaN(tr)) {
          totalTravelHours += tr;
        }
      }
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
    });

    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(10);
    
    let curY = finalY + 10;
    doc.text(`${t('grossWorkingTime')}: ${currentAdminMonthZK.grossHours.toFixed(2)} h`, 14, curY);
    doc.text(`${t('totalTravelTime')}: ${totalTravelHours.toFixed(2)} h`, 110, curY);

    if (currentAdminMonthZK.deduction > 0) {
      curY += 6;
      doc.setTextColor(180, 83, 9);
      doc.text(`Arbeitszeitkonto: -${currentAdminMonthZK.deduction.toFixed(2)} h`, 14, curY);
      
      curY += 6;
      doc.setTextColor(16, 185, 129);
      doc.text(`${t('netWorkingTime')}: ${currentAdminMonthZK.netHours.toFixed(2)} h`, 14, curY);
      doc.setTextColor(0, 0, 0);
    }

    curY += 7;
    doc.setTextColor(30, 58, 138);
    doc.text(`${t('bestandZeitkonto')}: ${currentAdminMonthZK.cumulativeBalance.toFixed(2)} / 200.00 h`, 14, curY);
    doc.setTextColor(0, 0, 0);

    doc.save(`AquaCon_Zeiterfassung_${selectedUser.username}.pdf`);
  };

  if (status === "loading" || (status === "authenticated" && (session?.user as any)?.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500 font-medium">
        Laden...
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {/* Admin Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{t('adminTitle')}</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Admin: <span className="font-semibold text-gray-700">{session?.user?.name}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Notification Bell for Pending Leaves */}
            <div className="relative">
              <button 
                onClick={() => setShowLeavesModal(!showLeavesModal)}
                className="relative p-2 rounded-xl bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center justify-center shadow-sm"
                title={t('pendingLeaves')}
                aria-label={t('pendingLeaves')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {pendingLeaves.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center shadow-md animate-pulse">
                    {pendingLeaves.length}
                  </span>
                )}
              </button>

              {/* Backdrop for closing dropdown */}
              {showLeavesModal && (
                <div 
                  className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:bg-transparent"
                  onClick={() => setShowLeavesModal(false)}
                />
              )}

              {/* Dropdown Menu */}
              {showLeavesModal && (
                <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-20 sm:top-full sm:right-0 mt-2 sm:w-80 bg-white border border-gray-200 rounded-2xl sm:rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3.5 border-b bg-gray-50 flex items-center justify-between">
                    <span className="font-bold text-gray-800 text-sm">{t('pendingLeaves')}</span>
                    <button 
                      onClick={() => setShowLeavesModal(false)}
                      className="text-gray-400 hover:text-gray-700 sm:hidden text-lg font-bold leading-none p-1"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="max-h-80 sm:max-h-96 overflow-y-auto">
                    {pendingLeaves.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">{t('noNewLeaves')}</div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {pendingLeaves.map(leave => {
                          const formatDbDate = (d: string) => {
                            const p = d?.split('-');
                            return p?.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
                          };
                          return (
                            <li key={leave.id} className="p-4 hover:bg-gray-50/80 transition-colors">
                              <div className="mb-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-blue-600">{leave.user?.username}</span>
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                    {leave.daysCount} {t('days')}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {t('requestsLeave')} <span className="font-medium text-gray-800">{formatDbDate(leave.startDate)} {t('to')} {formatDbDate(leave.endDate)}</span>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <button 
                                  onClick={() => handleLeaveAction(leave.id, 'APPROVED')} 
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 transition shadow-sm"
                                >
                                  {t('approve')}
                                </button>
                                <button 
                                  onClick={() => handleLeaveAction(leave.id, 'REJECTED')} 
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 transition shadow-sm"
                                >
                                  {t('decline')}
                                </button>
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

            <button 
              onClick={() => signOut()} 
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-sm"
            >
              {t('logout')}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="w-full md:w-1/3 space-y-6">
            <div className="bg-white shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 rounded-2xl border border-gray-100 border-t-4 border-t-blue-500">
              <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-900">{t('newWorker')}</h2>
              <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('username')}</label>
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
                    className="border border-gray-300 w-full p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('passwordPin')}</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="border border-gray-300 w-full p-2.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      aria-label={showNewPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                    >
                      {showNewPassword ? (
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('annualLeaveDaysLabel')}</label>
                  <input 
                    type="number" 
                    step="0.5"
                    value={annualLeaveDays}
                    onChange={e => setAnnualLeaveDays(e.target.value)}
                    className="border border-gray-300 w-full p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('entryDateLabel')}</label>
                  <input 
                    type="date" 
                    value={workerEntryDate}
                    onChange={e => setWorkerEntryDate(e.target.value)}
                    className="border border-gray-300 w-full p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" 
                  />
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl font-bold transition shadow-sm">
                  {t('saveBtn')}
                </button>
              </form>
            </div>
            
            <div className="bg-white shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 rounded-2xl border border-gray-100 border-t-4 border-t-slate-500">
              <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-900">{t('changeMyPassword')}</h2>
              <form onSubmit={handleAdminPasswordChange} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('newPassword')}</label>
                  <div className="relative">
                    <input 
                      type={showAdminPassword ? "text" : "password"} 
                      value={adminNewPassword}
                      onChange={e => setAdminNewPassword(e.target.value)}
                      className="border border-gray-300 w-full p-2.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder={t('min3Chars')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      aria-label={showAdminPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                    >
                      {showAdminPassword ? (
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
                <button type="submit" className="bg-slate-700 hover:bg-slate-800 text-white p-2.5 rounded-xl font-bold transition shadow-sm">
                  {t('updatePassword')}
                </button>
              </form>
            </div>

            <div className="bg-white shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 rounded-2xl border border-gray-100">
              <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-900">{t('workerList')}</h2>
              <ul className="space-y-3">
                {users.map(u => (
                  <li key={u.id} className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-base sm:text-lg text-gray-900">{u.username}</span>
                      <span className="text-xs text-gray-500 font-mono">
                        Passwort verschlüsselt (bei Bedarf neu vergeben)
                      </span>
                    </div>
                    {u.role !== 'ADMIN' && (
                      <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                        <button 
                          onClick={() => viewUserEntries(u)}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                        >
                          {t('times')}
                        </button>
                        <button 
                          onClick={() => changeWorkerPassword(u.id, u.username)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                        >
                          {t('password')}
                        </button>
                        <button 
                          onClick={() => deleteUser(u.id, u.username)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition"
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

          {/* Right Column */}
          <div className="w-full md:w-2/3">
            {selectedUser ? (
              <div className="bg-white shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 rounded-2xl border border-gray-100 border-t-4 border-t-green-500 h-full">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                      {t('timesOf')} <span className="text-blue-600">{selectedUser.username}</span>
                    </h2>
                    <select 
                      value={adminSelectedMonth} 
                      onChange={e => setAdminSelectedMonth(e.target.value)}
                      className="border border-gray-300 p-1.5 rounded-xl bg-gray-50 text-sm sm:text-base font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {availableMonths.map(ym => (
                        <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={generateAdminPDF} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm self-start sm:self-auto"
                  >
                    {t('exportPdf')}
                  </button>
                </div>

                {/* Show Leave Balances, Start Date & Zeitkonto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="block text-xs font-medium text-gray-500 mb-1">{t('entryDate')}</span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm sm:text-base text-gray-900">{formatDbDate(selectedUser.entryDate)}</span>
                      <button 
                        onClick={() => changeWorkerEntryDate(selectedUser.id, selectedUser.username, selectedUser.entryDate)}
                        className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded hover:bg-purple-100 font-medium transition"
                      >
                        {t('change')}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="block text-xs font-medium text-gray-500 mb-1">{t('annualLeave')}</span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-gray-900">{selectedUser.annualLeaveDays} {t('days')}</span>
                      <button 
                        onClick={() => changeWorkerLeave(selectedUser.id, selectedUser.username, selectedUser.annualLeaveDays)}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100 font-medium transition"
                      >
                        {t('change')}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <span className="block text-xs font-medium text-gray-500 mb-1">{t('lastYearRest')}</span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-green-600">{selectedUser.carriedOverLeaveDays} {t('days')}</span>
                      <button 
                        onClick={() => changeWorkerCarriedLeave(selectedUser.id, selectedUser.username, selectedUser.carriedOverLeaveDays)}
                        className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded hover:bg-green-100 font-medium transition"
                      >
                        {t('change')}
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const used = selectedUser.leaveRequests
                      ?.filter((l: any) => l.type === 'URLAUB' && new Date(l.createdAt).getFullYear() === new Date().getFullYear())
                      .reduce((sum: number, l: any) => sum + l.daysCount, 0) || 0;
                    const rest = selectedUser.annualLeaveDays + selectedUser.carriedOverLeaveDays - used;
                    return (
                      <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                        <span className="block text-xs font-medium text-gray-500 mb-1">{t('currentRest')}</span>
                        <span className="font-bold text-base text-blue-600">{rest} {t('days')}</span>
                      </div>
                    );
                  })()}

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200 shadow-sm">
                    <span className="block text-xs font-bold text-blue-900 mb-1">⏱️ {t('bestandZeitkonto')}</span>
                    <div className="flex items-baseline justify-between">
                      <span className="font-extrabold text-base text-indigo-700">
                        {adminZeitkontoData.currentBalance.toFixed(1)} <span className="text-xs font-semibold text-gray-500">/ 200 h</span>
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (adminZeitkontoData.currentBalance / 200) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left border-collapse min-w-[550px]">
                    <thead>
                      <tr className="bg-gray-100 text-xs text-gray-700 uppercase font-semibold">
                        <th className="p-3 border-b">{t('date')}</th>
                        <th className="p-3 border-b">{t('ort')}</th>
                        <th className="p-3 border-b">{t('start')}</th>
                        <th className="p-3 border-b">{t('endTime')}</th>
                        <th className="p-3 border-b">{t('pause')}</th>
                        <th className="p-3 border-b">{t('travel')}</th>
                        <th className="p-3 border-b">{t('totalH')}</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100">
                      {displayedUserEntries.length === 0 ? (
                        <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('noTimesYet')}</td></tr>
                      ) : (
                        displayedUserEntries.map((e: any) => {
                          const formattedDate = formatDateWithDay(e.date);

                          // Public Holiday without work
                          if (e.isFeiertag && e.isHolidayOff) {
                            return (
                              <tr key={e.id} className="bg-purple-50/40 hover:bg-purple-50/70 transition-colors">
                                <td className="p-3 font-medium text-gray-900">{formattedDate}</td>
                                <td className="p-3 font-bold" colSpan={1}>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 shadow-sm">
                                    🎉 {e.feiertagName}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400">-</td>
                                <td className="p-3 text-gray-400">-</td>
                                <td className="p-3 text-gray-400">0</td>
                                <td className="p-3 text-gray-400">0</td>
                                <td className="p-3">
                                  <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                    Feiertag frei
                                  </span>
                                </td>
                              </tr>
                            );
                          }

                          // Approved Leave
                          if (e.isLeave) {
                            return (
                              <tr key={e.id} className={`${e.leaveType === 'URLAUB' ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'bg-red-50/40 hover:bg-red-50/70'} transition-colors`}>
                                <td className="p-3 font-medium text-gray-900">{formattedDate}</td>
                                <td className="p-3 font-bold">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${e.leaveType === 'URLAUB' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>
                                    {e.leaveType === 'URLAUB' ? `🏖️ ${t('vacation')}` : `🤒 ${t('sick')}`}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400">-</td>
                                <td className="p-3 text-gray-400">-</td>
                                <td className="p-3 text-gray-400">0</td>
                                <td className="p-3 text-gray-400">0</td>
                                <td className="p-3">
                                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {e.leaveType === 'URLAUB' ? t('vacation') : t('sick')}
                                  </span>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={e.id} className={`hover:bg-blue-50/40 transition-colors ${e.isFeiertag ? 'bg-purple-50/20 border-l-4 border-purple-500' : ''}`}>
                              <td className="p-3 font-medium text-gray-900">{formattedDate}</td>
                              <td className="p-3 max-w-[150px] break-words text-gray-700">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span>{e.location || '-'}</span>
                                  {e.isFeiertag && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 shadow-sm">
                                      🎉 {e.feiertagName}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-gray-700">{e.startTime || '-'}</td>
                              <td className="p-3 text-gray-700">{e.endTime || '-'}</td>
                              <td className="p-3 text-gray-700">{e.pauseHours}</td>
                              <td className="p-3 text-gray-700">{e.travelHours}</td>
                              <td className="p-3 font-bold text-blue-600">
                                <div className="flex flex-col">
                                  <span>{e.totalHours ? e.totalHours.toFixed(2) : '-'} h</span>
                                  {e.isFeiertag && (
                                    <span className="text-[10px] font-semibold text-purple-700">Feiertagsarbeit</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {displayedUserEntries.length > 0 && (
                      <tfoot className="bg-blue-50 text-sm">
                        <tr className="font-bold border-t-2 border-blue-200">
                          <td colSpan={5} className="p-3 text-right text-gray-800 align-top">
                            <span className="font-bold">{t('totalHours')}:</span>
                          </td>
                          <td className="p-3 text-blue-800 font-bold align-top">
                            <div>{displayedUserEntries.reduce((sum, e) => sum + (parseFloat(e.travelHours) || 0), 0).toFixed(1)} h</div>
                            <div className="text-[10px] text-gray-500 font-normal">{t('totalTravelTime')}</div>
                          </td>
                          <td className="p-3 text-blue-800 font-bold align-top">
                            <div>{currentAdminMonthZK.grossHours.toFixed(2)} h</div>
                            <div className="text-[10px] text-gray-500 font-normal">{t('grossWorkingTime')}</div>
                            
                            {currentAdminMonthZK.deduction > 0 && (
                              <>
                                <div className="text-amber-700 text-xs font-semibold mt-1 pt-1 border-t border-blue-200">
                                  -{currentAdminMonthZK.deduction.toFixed(1)} h {t('zeitkontoTransfer')}
                                </div>
                                <div className="text-emerald-700 font-extrabold text-sm mt-0.5">
                                  = {currentAdminMonthZK.netHours.toFixed(2)} h
                                  <div className="text-[10px] text-emerald-600 font-normal">{t('netWorkingTime')}</div>
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Show Leave Requests for this user */}
                {selectedUser.leaveRequests && selectedUser.leaveRequests.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900">{t('absencesTitle')}</h3>
                    <ul className="space-y-2">
                      {selectedUser.leaveRequests.map((req: any) => {
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
                            <div>
                              <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-xs font-bold inline-block">
                                {t('approved')}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-8 sm:p-12 text-center text-gray-500 h-full min-h-[300px] flex items-center justify-center text-sm sm:text-base">
                {t('selectWorker')}
              </div>
            )}
          </div>
        </div>

      </main>
    </>
  );
}



