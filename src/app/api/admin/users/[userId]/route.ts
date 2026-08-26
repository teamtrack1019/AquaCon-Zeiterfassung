import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function DELETE(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(params.userId);

  // Prisma does not automatically cascade unless set in schema, so let's delete time entries first
  await prisma.timeEntry.deleteMany({
    where: { userId }
  });

  await prisma.user.delete({
    where: { id: userId }
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(params.userId);
  const { newPassword, annualLeaveDays, carriedOverLeaveDays } = await req.json();

  const dataToUpdate: any = {};

  if (newPassword) {
    if (newPassword.length < 3) return NextResponse.json({ error: "Passwort zu kurz" }, { status: 400 });
    dataToUpdate.password = newPassword;
  }

  if (annualLeaveDays !== undefined) {
    dataToUpdate.annualLeaveDays = parseInt(annualLeaveDays);
  }

  if (carriedOverLeaveDays !== undefined) {
    dataToUpdate.carriedOverLeaveDays = parseInt(carriedOverLeaveDays);
  }

  if (Object.keys(dataToUpdate).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate
    });
  }

  return NextResponse.json({ success: true });
}

