import { getGermanHolidays } from "@/lib/holidays";
import type { LeaveRequestRecord, TimeEntryRecord, UserRecord } from "@/lib/db";

function getWorkingDaysInRange(startDateStr: string, endDateStr: string): string[] {
  const [sY, sM, sD] = startDateStr.split("-").map(Number);
  const [eY, eM, eD] = endDateStr.split("-").map(Number);
  const start = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const y = current.getFullYear();
      const m = (current.getMonth() + 1).toString().padStart(2, "0");
      const d = current.getDate().toString().padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function computeTotalHours(
  startTime: string | null,
  endTime: string | null,
  pauseHours: any,
  travelHours: any
): number | null {
  if (!startTime || !endTime || startTime === "-" || endTime === "-") return null;
  const startParts = startTime.split(":");
  const stopParts = endTime.split(":");
  if (startParts.length < 2 || stopParts.length < 2) return null;
  const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  const stopMins = parseInt(stopParts[0]) * 60 + parseInt(stopParts[1]);
  let diffMins = stopMins - startMins;
  if (diffMins < 0) diffMins += 24 * 60;
  const diffHours = diffMins / 60;
  const finalPause = parseFloat(pauseHours) || 0;
  const finalTravel = parseFloat(travelHours) || 0;
  return parseFloat(Math.max(0, diffHours - finalPause - finalTravel).toFixed(2));
}

export function buildHistoryEntries(
  user: Pick<UserRecord, "id" | "entryDate" | "createdAt">,
  rawEntries: TimeEntryRecord[],
  approvedLeaves: LeaveRequestRecord[]
) {
  let earliestDate =
    user.entryDate ||
    (user.createdAt ? user.createdAt.substring(0, 10) : "2026-01-01");

  rawEntries.forEach((e) => {
    if (e.date && e.date < earliestDate) earliestDate = e.date;
  });
  approvedLeaves.forEach((l) => {
    if (l.startDate && l.startDate < earliestDate) earliestDate = l.startDate;
  });

  const startYear = parseInt(earliestDate.substring(0, 4)) || new Date().getFullYear();
  const currentYear = new Date().getFullYear();

  const yearsSet = new Set<number>();
  for (let y = startYear; y <= currentYear; y++) yearsSet.add(y);
  rawEntries.forEach((e) => {
    if (e.date) {
      const y = parseInt(e.date.substring(0, 4));
      if (!isNaN(y)) yearsSet.add(y);
    }
  });
  approvedLeaves.forEach((l) => {
    if (l.startDate) {
      const y = parseInt(l.startDate.substring(0, 4));
      if (!isNaN(y)) yearsSet.add(y);
    }
  });

  const holidaysMap: Record<string, string> = {};
  yearsSet.forEach((year) => {
    Object.assign(holidaysMap, getGermanHolidays(year));
  });

  const entries: any[] = rawEntries.map((e) => {
    const holidayName = holidaysMap[e.date];
    const calculatedTotal = computeTotalHours(
      e.startTime,
      e.endTime,
      e.pauseHours,
      e.travelHours
    );
    const entryObj = {
      ...e,
      totalHours: calculatedTotal !== null ? calculatedTotal : e.totalHours,
    };
    if (holidayName) {
      return { ...entryObj, isFeiertag: true, feiertagName: holidayName };
    }
    return entryObj;
  });

  const existingDates = new Set(entries.map((e) => e.date));

  approvedLeaves.forEach((leave) => {
    const days = getWorkingDaysInRange(leave.startDate, leave.endDate);
    days.forEach((dateStr) => {
      if (!existingDates.has(dateStr)) {
        existingDates.add(dateStr);
        const holidayName = holidaysMap[dateStr];
        entries.push({
          id: `leave-${leave.id}-${dateStr}`,
          userId: user.id,
          date: dateStr,
          startTime: "-",
          endTime: "-",
          pauseHours: 0,
          travelHours: 0,
          totalHours: null,
          location: leave.type === "URLAUB" ? "Urlaub" : "Krank",
          isLeave: true,
          leaveType: leave.type,
          leaveId: leave.id,
          isFeiertag: !!holidayName,
          feiertagName: holidayName || null,
        });
      }
    });
  });

  Object.entries(holidaysMap).forEach(([holidayDate, holidayName]) => {
    if (holidayDate >= earliestDate && !existingDates.has(holidayDate)) {
      const [y, m, d] = holidayDate.split("-").map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        existingDates.add(holidayDate);
        entries.push({
          id: `feiertag-${holidayDate}`,
          userId: user.id,
          date: holidayDate,
          startTime: "-",
          endTime: "-",
          pauseHours: 0,
          travelHours: 0,
          totalHours: null,
          location: `Feiertag (${holidayName})`,
          isFeiertag: true,
          isHolidayOff: true,
          feiertagName: holidayName,
        });
      }
    }
  });

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}
