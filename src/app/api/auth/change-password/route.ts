import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { findUserByUsername, updateUser } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length < 3) {
    return NextResponse.json({ error: "Passwort zu kurz" }, { status: 400 });
  }

  const user = await findUserByUsername(session.user.name);
  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  await updateUser(user.id, {
    password: await bcrypt.hash(newPassword, 10),
  });

  return NextResponse.json({ success: true });
}
