import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: true }
  });

  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the owner or an admin can delete it
  if (leave.user.username !== session.user.name && (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await prisma.leaveRequest.delete({
    where: { id }
  });

  return NextResponse.json({ success: true });
}

