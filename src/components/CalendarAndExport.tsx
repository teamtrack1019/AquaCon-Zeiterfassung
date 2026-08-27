"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CalendarAndExport({ userName, refreshTrigger }: { userName: string, refreshTrigger?: number }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit states for calendar
  const [editingId, setEditingId] = useState<number | null>(null);
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

  const handleDeleteClick = async (id: number) => {
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

  const handleSaveEdit = async (id: number) => {
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
      fetchEntries(); // Refresh
    } else {
      alert("Fehler beim Speichern");
    }
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
    
    const formatDateWithDay = (dateStr: string) => {
      if (!dateStr) return "-";
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        // The language for PDF can be based on 'de-DE' or 'ru-RU' but let's just stick to local formatting
        const dayName = d.toLocaleDateString('de-DE', { weekday: 'long' });
        return `${parts[2]}.${parts[1]}.${parts[0]} (${dayName})`;
      }
      return dateStr;
    };

    entries.forEach(entry => {
      const entryData = [
        formatDateWithDay(entry.date),
        entry.location || "-",
        entry.startTime || "-",
        entry.endTime || "-",
        entry.pauseHours.toString(),
        entry.travelHours.toString(),
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
    doc.text(`${t('workingTime')}: ${totalMonthHours.toFixed(2)} h`, 14, finalY + 10);

    doc.save(`aquaCon_Zeiterfassung_${userName}.pdf`);
  };

  if (loading) return <div className="mt-8 text-gray-500">...</div>;

  return (
    <div className="bg-white shadow p-6 rounded mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{t('calendar')}</h2>
        <button 
          onClick={generatePDF}
          className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition"
        >
          {t('exportPdf')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">{t('date')}</th>
              <th className="p-3">{t('ort')}</th>
              <th className="p-3">{t('start')}</th>
              <th className="p-3">{t('stop')}</th>
              <th className="p-3">{t('pauseHours')}</th>
              <th className="p-3">{t('travelHours')}</th>
              <th className="p-3">{t('totalH')}</th>
              <th className="p-3">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={8} className="p-3 text-center text-gray-500">{t('noEntries')}</td>
              </tr>
            )}
            {entries.map((entry) => {
              const formattedDate = entry.date ? (() => {
                const parts = entry.date.split('-');
                if (parts.length === 3) {
                  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                  const dayName = d.toLocaleDateString('de-DE', { weekday: 'long' });
                  return `${parts[2]}.${parts[1]}.${parts[0]} (${dayName})`;
                }
                return entry.date;
              })() : '-';
              if (editingId === entry.id) {
                return (
                  <tr key={entry.id} className="border-b bg-yellow-50">
                    <td className="p-3">{formattedDate}</td>
                    <td className="p-2"><input className="border w-24 p-1" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} /></td>
                    <td className="p-2"><input type="time" className="border w-20 p-1" value={editForm.startTime} onChange={e => setEditForm({...editForm, startTime: e.target.value})} /></td>
                    <td className="p-2"><input type="time" className="border w-20 p-1" value={editForm.endTime} onChange={e => setEditForm({...editForm, endTime: e.target.value})} /></td>
                    <td className="p-2"><input type="number" step="0.5" className="border w-16 p-1" value={editForm.pauseHours} onChange={e => setEditForm({...editForm, pauseHours: e.target.value})} /></td>
                    <td className="p-2"><input type="number" step="0.5" className="border w-16 p-1" value={editForm.travelHours} onChange={e => setEditForm({...editForm, travelHours: e.target.value})} /></td>
                    <td className="p-3 font-bold">{entry.totalHours || '-'}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => handleSaveEdit(entry.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">{t('save')}</button>
                      <button onClick={() => setEditingId(null)} className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">{t('cancel')}</button>
                    </td>
                  </tr>
                );
              }

              return (
              <tr key={entry.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{formattedDate}</td>
                <td className="p-3">{entry.location || '-'}</td>
                <td className="p-3">{entry.startTime || '-'}</td>
                <td className="p-3">{entry.endTime || '-'}</td>
                <td className="p-3">{entry.pauseHours}</td>
                <td className="p-3">{entry.travelHours}</td>
                <td className="p-3 font-bold">{entry.totalHours || '-'}</td>
                <td className="p-3">
                  <button onClick={() => handleEditClick(entry)} className="bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 text-xs font-semibold">{t('edit')}</button>
                </td>
              </tr>
              );
            })}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={6} className="p-3 text-right">{t('totalHours')}:</td>
                <td colSpan={2} className="p-3 text-blue-700 text-lg">
                  {entries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0).toFixed(2)} h
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

