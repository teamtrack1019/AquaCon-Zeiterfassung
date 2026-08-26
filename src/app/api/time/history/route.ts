import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get all time entries for the user, ordered by date descending
  const entries = await prisma.timeEntry.findMany({
    where: { userId: user.id },
    orderBy: [
      { date: 'desc' },
      { id: 'desc' }
    ]
  });

  return NextResponse.json(entries);
}

