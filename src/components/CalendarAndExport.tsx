"use client";
import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateZeitkonto } from "@/lib/zeitkonto";
import { AQUACON_LOGO_BASE64 } from "@/lib/logoBase64";
import { isDateInCurrentWorkWeek } from "@/lib/workWeek";

export default function CalendarAndExport({ userName, refreshTrigger }: { userName: string, refreshTrigger?: number }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
  }, []);

  // Edit states for calendar
  const [editingId, setEditingId] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchEntries();
  }, [refreshTrigger]);

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/time/history');
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
        try {
          localStorage.setItem("aquacon_cached_history", JSON.stringify(data));
        } catch (e) {}
      }
    } catch (e) {
      // Offline fallback: restore cached entries
      try {
        const cached = localStorage.getItem("aquacon_cached_history");
        if (cached) {
          setEntries(JSON.parse(cached));
        }
      } catch (err) {}
    } finally {
      setLoading(false);
    }
  };

  const zeitkontoData = useMemo(() => {
    return calculateZeitkonto(entries);
  }, [entries]);

  const displayedEntries = useMemo(() => {
    return entries.filter(e => e.date && e.date.startsWith(selectedMonth));
  }, [entries, selectedMonth]);

  const currentMonthZK = useMemo(() => {
    if (zeitkontoData.months[selectedMonth]) {
      return zeitkontoData.months[selectedMonth];
    }
    const gross = displayedEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    const availableCap = Math.max(0, 200 - zeitkontoData.currentBalance);
    const deduction = gross > 0 ? Math.min(5.0, availableCap) : 0;
    return {
      month: selectedMonth,
      grossHours: parseFloat(gross.toFixed(2)),
      deduction: parseFloat(deduction.toFixed(2)),
      netHours: parseFloat(Math.max(0, gross - deduction).toFixed(2)),
      cumulativeBalance: parseFloat(Math.min(200, zeitkontoData.currentBalance + deduction).toFixed(2)),
    };
  }, [zeitkontoData, selectedMonth, displayedEntries]);

  const handleEditClick = (entry: any) => {
    setEditingId(entry.id);
    setEditForm({
      startTime: entry.startTime || "",
      endTime: entry.endTime || "",
      pauseHours: entry.pauseHours?.toString() || "0",
      travelHours: entry.travelHours?.toString() || "0",
      location: entry.location || ""
    });
  };

  const handleDeleteClick = async (id: any) => {
    if (confirm("Möchten Sie diesen Eintrag wirklich löschen? / Вы действительно хотите удалить эту запись?")) {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      if (res.ok) {
        fetchEntries();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Fehler beim Löschen");
      }
    }
  };

  const handleSaveEdit = async (id: any) => {
    const res = await fetch('/api/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'update', 
        id,
        ...editForm
      })
    });
    if (res.ok) {
      setEditingId(null);
      fetchEntries();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Fehler beim Speichern");
    }
  };

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
    entries.forEach(e => {
      if (e.date) {
        set.add(e.date.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [entries]);

  const formatMonthLabel = (ym: string) => {
    const parts = ym.split('-');
    return `${parts[1]}/${parts[0]}`;
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

  const generatePDF = () => {
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
    doc.text(`Mitarbeiter: ${userName}`, 14, 28);
    const currentDate = new Date().toLocaleDateString('de-DE');
    doc.text(`Monat: ${formatMonthLabel(selectedMonth)}  |  Erstelldatum: ${currentDate}`, 14, 35);
    doc.setTextColor(0, 0, 0);

    // Table Data
    const tableColumn = [t('date'), t('ort'), t('start'), t('stop'), t('pauseHours'), t('travelHours'), t('totalH')];
    const tableRows: any[] = [];
    
    let totalMonthHours = 0;
    let totalTravelHours = 0;

    displayedEntries.forEach(entry => {
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
    doc.text(`${t('grossWorkingTime')}: ${currentMonthZK.grossHours.toFixed(2)} h`, 14, curY);
    doc.text(`${t('totalTravelTime')}: ${totalTravelHours.toFixed(2)} h`, 110, curY);

    if (currentMonthZK.deduction > 0) {
      curY += 6;
      doc.setTextColor(180, 83, 9);
      doc.text(`Arbeitszeitkonto: -${currentMonthZK.deduction.toFixed(2)} h`, 14, curY);
      
      curY += 6;
      doc.setTextColor(16, 185, 129);
      doc.text(`${t('netWorkingTime')}: ${currentMonthZK.netHours.toFixed(2)} h`, 14, curY);
      doc.setTextColor(0, 0, 0);
    }

    curY += 7;
    doc.setTextColor(30, 58, 138);
    doc.text(`${t('bestandZeitkonto')}: ${currentMonthZK.cumulativeBalance.toFixed(2)} / 200.00 h`, 14, curY);
    doc.setTextColor(0, 0, 0);

    doc.save(`AquaCon_Zeiterfassung_${userName}.pdf`);
  };

  if (loading) return <div className="mt-8 text-gray-500">Laden...</div>;

  return (
    <div className="bg-white shadow p-4 sm:p-6 rounded-2xl mt-8 border border-gray-100">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">{t('calendar')}</h2>
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 p-2 rounded-xl bg-gray-50 text-base sm:text-lg font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableMonths.map(ym => (
              <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={generatePDF}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition shadow-sm"
        >
          {t('exportPdf')}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">{t('weekEditHint')}</p>

      {/* Zeitkonto Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-3.5 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
            ⏱️
          </div>
          <div>
            <div className="font-bold text-gray-900">{t('bestandZeitkonto')}</div>
            <div className="text-blue-700 font-extrabold text-sm sm:text-base">
              {zeitkontoData.currentBalance.toFixed(1)} <span className="text-xs font-semibold text-gray-500">/ 200.0 h</span>
            </div>
          </div>
        </div>

        {currentMonthZK.deduction > 0 ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-900 font-medium text-xs">
            <span>ℹ️</span>
            <span>{selectedMonth}: <strong>-{currentMonthZK.deduction.toFixed(1)} h</strong> {t('zeitkontoTransfer')}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-900 font-medium text-xs">
            <span>✅</span>
            <span>{zeitkontoData.currentBalance >= 200 ? t('zeitkontoLimitReached') : `${t('grossWorkingTime')} = ${t('netWorkingTime')}`}</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left border-collapse min-w-[550px]">
          <thead>
            <tr className="bg-gray-100 text-xs text-gray-700 uppercase font-semibold">
              <th className="p-3 border-b">{t('date')}</th>
              <th className="p-3 border-b">{t('ort')}</th>
              <th className="p-3 border-b">{t('start')}</th>
              <th className="p-3 border-b">{t('stop')}</th>
              <th className="p-3 border-b">{t('pauseHours')}</th>
              <th className="p-3 border-b">{t('travelHours')}</th>
              <th className="p-3 border-b">{t('totalH')}</th>
              <th className="p-3 border-b">Aktionen</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {displayedEntries.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">{t('noEntries')}</td>
              </tr>
            )}
            {displayedEntries.map((entry) => {
              const formattedDate = formatDateWithDay(entry.date);

              // Public Holiday (Feiertag) without work
              if (entry.isFeiertag && entry.isHolidayOff) {
                return (
                  <tr key={entry.id} className="bg-purple-50/40 hover:bg-purple-50/70 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{formattedDate}</td>
                    <td className="p-3 font-bold" colSpan={1}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 shadow-sm">
                        🎉 {entry.feiertagName}
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
                    <td className="p-3">
                      <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full text-xs font-bold inline-block">
                        Feiertag
                      </span>
                    </td>
                  </tr>
                );
              }

              // Approved Leave (Urlaub / Krank)
              if (entry.isLeave) {
                return (
                  <tr key={entry.id} className={`${entry.leaveType === 'URLAUB' ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'bg-red-50/40 hover:bg-red-50/70'} transition-colors`}>
                    <td className="p-3 font-medium text-gray-900">{formattedDate}</td>
                    <td className="p-3 font-bold">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${entry.leaveType === 'URLAUB' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>
                        {entry.leaveType === 'URLAUB' ? `🏖️ ${t('vacation')}` : `🤒 ${t('sick')}`}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400">-</td>
                    <td className="p-3 text-gray-400">-</td>
                    <td className="p-3 text-gray-400">0</td>
                    <td className="p-3 text-gray-400">0</td>
                    <td className="p-3">
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        {entry.leaveType === 'URLAUB' ? t('vacation') : t('sick')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-xs font-bold inline-block">
                        {t('approved')}
                      </span>
                    </td>
                  </tr>
                );
              }

              if (editingId === entry.id) {
                return (
                  <tr key={entry.id} className="bg-yellow-50/80">
                    <td className="p-3">{formattedDate}</td>
                    <td className="p-2"><input className="border border-gray-300 rounded p-1.5 w-24 text-xs" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} /></td>
                    <td className="p-2"><input type="time" className="border border-gray-300 rounded p-1.5 w-20 text-xs" value={editForm.startTime} onChange={e => setEditForm({...editForm, startTime: e.target.value})} /></td>
                    <td className="p-2"><input type="time" className="border border-gray-300 rounded p-1.5 w-20 text-xs" value={editForm.endTime} onChange={e => setEditForm({...editForm, endTime: e.target.value})} /></td>
                    <td className="p-2"><input type="number" step="0.5" className="border border-gray-300 rounded p-1.5 w-16 text-xs" value={editForm.pauseHours} onChange={e => setEditForm({...editForm, pauseHours: e.target.value})} /></td>
                    <td className="p-2"><input type="number" step="0.5" className="border border-gray-300 rounded p-1.5 w-16 text-xs" value={editForm.travelHours} onChange={e => setEditForm({...editForm, travelHours: e.target.value})} /></td>
                    <td className="p-3 font-bold text-blue-600">{entry.totalHours || '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => handleSaveEdit(entry.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">{t('save')}</button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">{t('cancel')}</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={entry.id} className={`hover:bg-blue-50/40 transition-colors ${entry.isFeiertag ? 'bg-purple-50/20 border-l-4 border-purple-500' : ''}`}>
                  <td className="p-3 font-medium text-gray-900">{formattedDate}</td>
                  <td className="p-3 text-gray-700">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{entry.location || '-'}</span>
                      {entry.isFeiertag && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 shadow-sm">
                          🎉 {entry.feiertagName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-gray-700">{entry.startTime || '-'}</td>
                  <td className="p-3 text-gray-700">{entry.endTime || '-'}</td>
                  <td className="p-3 text-gray-700">{entry.pauseHours}</td>
                  <td className="p-3 text-gray-700">{entry.travelHours}</td>
                  <td className="p-3 font-bold text-blue-600">
                    <div className="flex flex-col">
                      <span>{entry.totalHours ? entry.totalHours.toFixed(2) : '-'} h</span>
                      {entry.isFeiertag && (
                        <span className="text-[10px] font-semibold text-purple-700">Feiertagsarbeit</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {isDateInCurrentWorkWeek(entry.date) ? (
                      <div className="flex gap-1.5 items-center">
                        <button onClick={() => handleEditClick(entry)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-xs font-semibold transition">{t('edit')}</button>
                        <button onClick={() => handleDeleteClick(entry.id)} className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded text-xs font-semibold transition">{t('delete')}</button>
                      </div>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-500 px-2.5 py-1 rounded text-xs font-semibold">{t('weekLocked')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {displayedEntries.length > 0 && (
            <tfoot className="bg-blue-50 text-sm">
              <tr className="font-bold border-t-2 border-blue-200">
                <td colSpan={5} className="p-3 text-right text-gray-800 align-top">
                  <span className="font-bold">{t('totalHours')}:</span>
                </td>
                <td className="p-3 text-blue-800 font-bold align-top">
                  <div>{displayedEntries.reduce((sum, entry) => sum + (parseFloat(entry.travelHours) || 0), 0).toFixed(1)} h</div>
                  <div className="text-[10px] text-gray-500 font-normal">{t('totalTravelTime')}</div>
                </td>
                <td className="p-3 text-blue-800 font-bold align-top">
                  <div>{currentMonthZK.grossHours.toFixed(2)} h</div>
                  <div className="text-[10px] text-gray-500 font-normal">{t('grossWorkingTime')}</div>
                  
                  {currentMonthZK.deduction > 0 && (
                    <>
                      <div className="text-amber-700 text-xs font-semibold mt-1 pt-1 border-t border-blue-200">
                        -{currentMonthZK.deduction.toFixed(1)} h {t('zeitkontoTransfer')}
                      </div>
                      <div className="text-emerald-700 font-extrabold text-sm mt-0.5">
                        = {currentMonthZK.netHours.toFixed(2)} h
                        <div className="text-[10px] text-emerald-600 font-normal">{t('netWorkingTime')}</div>
                      </div>
                    </>
                  )}
                </td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
