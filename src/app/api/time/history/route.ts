import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildHistoryEntries } from "@/lib/buildHistoryEntries";
import {
  findUserByUsername,
  listLeaveRequestsForUser,
  listTimeEntriesForUser,
} from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByUsername(session.user.name);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const rawEntries = await listTimeEntriesForUser(user.id);
  const approvedLeaves = (await listLeaveRequestsForUser(user.id)).filter(
    (l) => l.status === "APPROVED"
  );

  return NextResponse.json(buildHistoryEntries(user, rawEntries, approvedLeaves));
}
