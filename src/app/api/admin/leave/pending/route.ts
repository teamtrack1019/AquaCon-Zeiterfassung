import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPendingLeaves } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pendingRequests = await listPendingLeaves();
  return NextResponse.json(pendingRequests);
}
