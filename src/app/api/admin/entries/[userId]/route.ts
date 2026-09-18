import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGermanHolidays } from '@/lib/holidays';

const prisma = new PrismaClient();

function getWorkingDaysInRange(startDateStr: string, endDateStr: string): string[] {
  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  const [eY, eM, eD] = endDateStr.split('-').map(Number);
  const start = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);
  
  const dates: string[] = [];
  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday (Only Monday-Friday are working days)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const y = current.getFullYear();
      const m = (current.getMonth() + 1).toString().padStart(2, '0');
      const d = current.getDate().toString().padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(params.userId);
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, entryDate: true, createdAt: true }
  });

  const rawEntries: any[] = await prisma.timeEntry.findMany({
    where: { userId: userId },
    orderBy: [
      { date: 'desc' },
      { id: 'desc' }
    ]
  });

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: userId,
      status: 'APPROVED'
    }
  });

  // Determine earliest active date for the employee
  let earliestDate = user?.entryDate || (user?.createdAt ? user.createdAt.toISOString().substring(0, 10) : '2026-01-01');
  rawEntries.forEach(e => {
    if (e.date && e.date < earliestDate) {
      earliestDate = e.date;
    }
  });
  approvedLeaves.forEach(l => {
    if (l.startDate && l.startDate < earliestDate) {
      earliestDate = l.startDate;
    }
  });

  const startYear = parseInt(earliestDate.substring(0, 4)) || new Date().getFullYear();
  const currentYear = new Date().getFullYear();

  const yearsSet = new Set<number>();
  for (let y = startYear; y <= currentYear; y++) {
    yearsSet.add(y);
  }
  rawEntries.forEach(e => {
    if (e.date) {
      const y = parseInt(e.date.substring(0, 4));
      if (!isNaN(y)) yearsSet.add(y);
    }
  });
  approvedLeaves.forEach(l => {
    if (l.startDate) {
      const y = parseInt(l.startDate.substring(0, 4));
      if (!isNaN(y)) yearsSet.add(y);
    }
  });

  // Generate holidays map for all relevant years
  const holidaysMap: Record<string, string> = {};
  yearsSet.forEach(year => {
    const h = getGermanHolidays(year);
    Object.assign(holidaysMap, h);
  });

  // Process raw entries and mark if worked on a holiday
  const entries: any[] = rawEntries.map(e => {
    const holidayName = holidaysMap[e.date];
    if (holidayName) {
      return {
        ...e,
        isFeiertag: true,
        feiertagName: holidayName
      };
    }
    return e;
  });

  const existingDates = new Set(entries.map(e => e.date));

  approvedLeaves.forEach(leave => {
    const days = getWorkingDaysInRange(leave.startDate, leave.endDate);
    days.forEach(dateStr => {
      if (!existingDates.has(dateStr)) {
        existingDates.add(dateStr);
        const holidayName = holidaysMap[dateStr];
        entries.push({
          id: `leave-${leave.id}-${dateStr}`,
          userId: userId,
          date: dateStr,
          startTime: "-",
          endTime: "-",
          pauseHours: 0,
          travelHours: 0,
          totalHours: null,
          location: leave.type === 'URLAUB' ? 'Urlaub' : 'Krank',
          isLeave: true,
          leaveType: leave.type,
          leaveId: leave.id,
          isFeiertag: !!holidayName,
          feiertagName: holidayName || null
        });
      }
    });
  });

  // Generate entries for public holidays (Feiertage) on workdays where user didn't work and didn't take leave
  Object.entries(holidaysMap).forEach(([holidayDate, holidayName]) => {
    // Only generate holidays on or after the worker's start date
    if (holidayDate >= earliestDate && !existingDates.has(holidayDate)) {
      const [y, m, d] = holidayDate.split('-').map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      // Add if Monday-Friday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        existingDates.add(holidayDate);
        entries.push({
          id: `feiertag-${holidayDate}`,
          userId: userId,
          date: holidayDate,
          startTime: "-",
          endTime: "-",
          pauseHours: 0,
          travelHours: 0,
          totalHours: null,
          location: `Feiertag (${holidayName})`,
          isFeiertag: true,
          isHolidayOff: true,
          feiertagName: holidayName
        });
      }
    }
  });

  entries.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json(entries);
}

