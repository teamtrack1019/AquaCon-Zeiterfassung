import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateLeaveStatus } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const leave = await updateLeaveStatus(params.id, status);
  return NextResponse.json(leave);
}
