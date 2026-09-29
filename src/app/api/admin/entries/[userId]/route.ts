import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildHistoryEntries } from "@/lib/buildHistoryEntries";
import {
  findUserById,
  listLeaveRequestsForUser,
  listTimeEntriesForUser,
} from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserById(params.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const rawEntries = await listTimeEntriesForUser(user.id);
  const approvedLeaves = (await listLeaveRequestsForUser(user.id)).filter(
    (l) => l.status === "APPROVED"
  );

  return NextResponse.json(buildHistoryEntries(user, rawEntries, approvedLeaves));
}
