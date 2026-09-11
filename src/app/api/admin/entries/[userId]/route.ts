import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
  
  const entries: any[] = await prisma.timeEntry.findMany({
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

  const existingDates = new Set(entries.map(e => e.date));

  approvedLeaves.forEach(leave => {
    const days = getWorkingDaysInRange(leave.startDate, leave.endDate);
    days.forEach(dateStr => {
      if (!existingDates.has(dateStr)) {
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
          leaveId: leave.id
        });
      }
    });
  });

  entries.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json(entries);
}

