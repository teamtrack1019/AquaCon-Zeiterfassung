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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get all time entries for the user
  const rawEntries: any[] = await prisma.timeEntry.findMany({
    where: { userId: user.id },
    orderBy: [
      { date: 'desc' },
      { id: 'desc' }
    ]
  });

  // Get all approved leave requests for the user
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: user.id,
      status: 'APPROVED'
    }
  });

  // Collect relevant years
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
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

  // Generate entries for approved leave dates
  approvedLeaves.forEach(leave => {
    const days = getWorkingDaysInRange(leave.startDate, leave.endDate);
    days.forEach(dateStr => {
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
    if (!existingDates.has(holidayDate)) {
      const [y, m, d] = holidayDate.split('-').map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      // Add if Monday-Friday
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
          feiertagName: holidayName
        });
      }
    }
  });

  // Sort all entries descending by date
  entries.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json(entries);
}

