import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { role: 'WORKER' },
    select: { 
      id: true, 
      username: true, 
      password: true,
      role: true,
      annualLeaveDays: true,
      carriedOverLeaveDays: true,
      lastCarryOverYear: true,
      entryDate: true,
      leaveRequests: {
        where: { status: 'APPROVED' }
      }
    }
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, password, role, annualLeaveDays, entryDate } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    return NextResponse.json({ error: "Benutzername existiert bereits" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      password: password,
      role: 'WORKER',
      annualLeaveDays: annualLeaveDays ? parseFloat(annualLeaveDays.toString().replace(',', '.')) : 30,
      entryDate: entryDate || null
    },
    select: { id: true, username: true, role: true, annualLeaveDays: true, entryDate: true }
  });

  return NextResponse.json(user);
}

