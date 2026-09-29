import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { createUser, findUserByUsername, listWorkersWithApprovedLeaves } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listWorkersWithApprovedLeaves();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, annualLeaveDays, entryDate } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (String(password).length < 3) {
    return NextResponse.json({ error: "Passwort zu kurz" }, { status: 400 });
  }

  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    return NextResponse.json({ error: "Benutzername existiert bereits" }, { status: 400 });
  }

  const user = await createUser({
    username,
    password: await bcrypt.hash(String(password), 10),
    role: "WORKER",
    annualLeaveDays: annualLeaveDays
      ? parseFloat(annualLeaveDays.toString().replace(",", "."))
      : 30,
    entryDate: entryDate || null,
  });

  return NextResponse.json({
    id: user.id,
    username: user.username,
    role: user.role,
    annualLeaveDays: user.annualLeaveDays,
    entryDate: user.entryDate,
  });
}
