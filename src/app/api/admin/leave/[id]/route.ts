import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);
  const { status } = await req.json(); // "APPROVED" or "REJECTED"

  if (status !== 'APPROVED' && status !== 'REJECTED') {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.update({
    where: { id },
    data: { status }
  });

  return NextResponse.json(leave);
}

