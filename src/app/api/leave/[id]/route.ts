import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteLeave, findLeaveById, findUserById } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leave = await findLeaveById(params.id);
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = await findUserById(leave.userId);
  if (
    owner?.username !== session.user.name &&
    (session.user as { role?: string }).role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await deleteLeave(params.id);
  return NextResponse.json({ success: true });
}
