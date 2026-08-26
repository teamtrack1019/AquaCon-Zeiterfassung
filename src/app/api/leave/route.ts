import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

// Hafta sonları hariç gün hesaplama fonksiyonu
function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  let count = 0;
  
  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Pazar, 6 = Cumartesi
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ 
    where: { username: session.user.name },
    include: {
      leaveRequests: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Otomatik devir kontrolü
  const currentYear = new Date().getFullYear();
  if (user.lastCarryOverYear < currentYear) {
    // Devir işlemi yap
    // Önceki yıldan kalan izin hesapla
    const pastApprovedUrlaub = user.leaveRequests
      .filter(l => l.type === 'URLAUB' && l.status === 'APPROVED' && new Date(l.createdAt).getFullYear() === user.lastCarryOverYear)
      .reduce((sum, l) => sum + l.daysCount, 0);
      
    const rest = (user.annualLeaveDays + user.carriedOverLeaveDays) - pastApprovedUrlaub;
    const finalCarryOver = rest > 0 ? rest : 0;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastCarryOverYear: currentYear,
        carriedOverLeaveDays: finalCarryOver
      }
    });
    
    user.lastCarryOverYear = currentYear;
    user.carriedOverLeaveDays = finalCarryOver;
  }

  return NextResponse.json(user);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { type, startDate, endDate } = await req.json();

  if (!type || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const daysCount = calculateWorkingDays(startDate, endDate);
  
  if (daysCount === 0) {
    return NextResponse.json({ error: "Seçilen tarihler arasında iş günü bulunmuyor." }, { status: 400 });
  }

  // Rapor (Krank) ise direkt onaylanır, Urlaub ise onaya düşer
  const status = type === 'KRANK' ? 'APPROVED' : 'PENDING';

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      type,
      startDate,
      endDate,
      daysCount,
      status
    }
  });

  return NextResponse.json(leaveRequest);
}

