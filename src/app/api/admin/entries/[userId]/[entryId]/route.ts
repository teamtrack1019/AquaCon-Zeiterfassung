import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteTimeEntry, findTimeEntryById, updateTimeEntry } from "@/lib/db";
import { computeTotalHours } from "@/lib/timeMath";

function isAdmin(session: { user?: { role?: string } } | null) {
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

export async function PATCH(
  req: Request,
  { params }: { params: { userId: string; entryId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entry = await findTimeEntryById(params.entryId);
  if (!entry || entry.userId !== params.userId) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const body = await req.json();
  const startTime = body.startTime !== undefined ? body.startTime : entry.startTime;
  const endTime = body.endTime !== undefined ? body.endTime : entry.endTime;
  const pauseHours = parseFloat(body.pauseHours) || 0;
  const travelHours = parseFloat(body.travelHours) || 0;
  const location = body.location !== undefined ? body.location : entry.location;
  const totalHours = computeTotalHours(startTime, endTime, pauseHours, travelHours);

  const updated = await updateTimeEntry(entry.id, {
    startTime: startTime || null,
    endTime: endTime || null,
    pauseHours,
    travelHours,
    location: location || null,
    ...(totalHours !== null && { totalHours }),
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string; entryId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entry = await findTimeEntryById(params.entryId);
  if (!entry || entry.userId !== params.userId) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await deleteTimeEntry(entry.id);
  return NextResponse.json({ success: true });
}
