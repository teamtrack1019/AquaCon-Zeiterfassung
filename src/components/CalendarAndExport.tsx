"use client";
import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        alert("Fehler beim Löschen");
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
      alert("Fehler beim Speichern");
    }
  };

  const displayedEntries = useMemo(() => {
    return entries.filter(e => e.date && e.date.startsWith(selectedMonth));
  }, [entries, selectedMonth]);

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
    
    // Header
    doc.setFontSize(18);
    doc.text("aquaCon Zeiterfassung", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Mitarbeiter: ${userName}`, 14, 30);
    const currentDate = new Date().toLocaleDateString('de-DE');
    doc.text(`Erstelldatum: ${currentDate}`, 14, 36);

    // Table Data
    const tableColumn = [t('date'), t('ort'), t('start'), t('stop'), t('pauseHours'), t('travelHours'), t('totalH')];
    const tableRows: any[] = [];
    
    let totalMonthHours = 0;

    displayedEntries.forEach(entry => {
      const entryData = [
        formatDateWithDay(entry.date),
        entry.isLeave ? (entry.leaveType === 'URLAUB' ? t('vacation') : t('sick')) : (entry.location || "-"),
        entry.isLeave ? "-" : (entry.startTime || "-"),
        entry.isLeave ? "-" : (entry.endTime || "-"),
        entry.isLeave ? "0" : (entry.pauseHours?.toString() || "0"),
        entry.isLeave ? "0" : (entry.travelHours?.toString() || "0"),
        entry.isLeave ? (entry.leaveType === 'URLAUB' ? t('vacation') : t('sick')) : (entry.totalHours ? entry.totalHours.toString() : "-")
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
    doc.text(`${t('workingTime')}: ${totalMonthHours.toFixed(2)} h`, 14, finalY + 10);

    doc.save(`aquaCon_Zeiterfassung_${userName}.pdf`);
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
                <tr key={entry.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="p-3 font-medium text-gray-900">{formattedDate}</td>
                  <td className="p-3 text-gray-700">{entry.location || '-'}</td>
                  <td className="p-3 text-gray-700">{entry.startTime || '-'}</td>
                  <td className="p-3 text-gray-700">{entry.endTime || '-'}</td>
                  <td className="p-3 text-gray-700">{entry.pauseHours}</td>
                  <td className="p-3 text-gray-700">{entry.travelHours}</td>
                  <td className="p-3 font-bold text-blue-600">{entry.totalHours ? entry.totalHours.toFixed(2) : '-'}</td>
                  <td className="p-3">
                    <div className="flex gap-1.5 items-center">
                      <button onClick={() => handleEditClick(entry)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-xs font-semibold transition">{t('edit')}</button>
                      <button onClick={() => handleDeleteClick(entry.id)} className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded text-xs font-semibold transition">{t('delete')}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {displayedEntries.length > 0 && (
            <tfoot className="bg-blue-50 text-sm">
              <tr className="font-bold border-t-2 border-blue-200">
                <td colSpan={6} className="p-3 text-right text-gray-800">{t('totalHours')}:</td>
                <td colSpan={2} className="p-3 text-blue-700 font-bold">
                  {displayedEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0).toFixed(2)} h
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
