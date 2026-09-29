import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pendingRequests = await prisma.leaveRequest.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { username: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json(pendingRequests);
}



