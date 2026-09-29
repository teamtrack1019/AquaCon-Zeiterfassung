import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(params.userId, 10);

  await prisma.leaveRequest.deleteMany({ where: { userId } });
  await prisma.timeEntry.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(params.userId, 10);
  const { newPassword, annualLeaveDays, carriedOverLeaveDays, entryDate } =
    await req.json();

  const dataToUpdate: {
    password?: string;
    annualLeaveDays?: number;
    carriedOverLeaveDays?: number;
    entryDate?: string | null;
  } = {};

  if (newPassword) {
    if (String(newPassword).length < 3) {
      return NextResponse.json({ error: "Passwort zu kurz" }, { status: 400 });
    }
    dataToUpdate.password = await bcrypt.hash(String(newPassword), 10);
  }

  if (annualLeaveDays !== undefined) {
    dataToUpdate.annualLeaveDays = parseFloat(
      annualLeaveDays.toString().replace(",", ".")
    );
  }

  if (carriedOverLeaveDays !== undefined) {
    dataToUpdate.carriedOverLeaveDays = parseFloat(
      carriedOverLeaveDays.toString().replace(",", ".")
    );
  }

  if (entryDate !== undefined) {
    dataToUpdate.entryDate = entryDate || null;
  }

  if (Object.keys(dataToUpdate).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });
  }

  return NextResponse.json({ success: true });
}
