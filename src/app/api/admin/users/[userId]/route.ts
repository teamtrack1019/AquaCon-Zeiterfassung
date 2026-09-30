import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { deleteUserCascade, updateUser } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteUserCascade(params.userId);
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

  const { newPassword, annualLeaveDays, carriedOverLeaveDays, entryDate, firstName, lastName } =
    await req.json();

  const dataToUpdate: {
    password?: string;
    firstName?: string;
    lastName?: string;
    annualLeaveDays?: number;
    carriedOverLeaveDays?: number;
    entryDate?: string | null;
  } = {};

  if (firstName !== undefined || lastName !== undefined) {
    const nextFirst = String(firstName || "").trim();
    const nextLast = String(lastName || "").trim();
    if (!nextFirst || !nextLast) {
      return NextResponse.json({ error: "Vorname und Nachname sind erforderlich" }, { status: 400 });
    }
    dataToUpdate.firstName = nextFirst;
    dataToUpdate.lastName = nextLast;
  }

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
    await updateUser(params.userId, dataToUpdate);
  }

  return NextResponse.json({ success: true });
}
