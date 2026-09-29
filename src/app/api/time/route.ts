import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createTimeEntry,
  deleteTimeEntry,
  findLastEntryWithLocation,
  findTimeEntryById,
  findTodayEntry,
  findUserByUsername,
  updateTimeEntry,
} from "@/lib/db";

function getTodayStr() {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getCurrentTimeStr() {
  const date = new Date();
  return date.toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByUsername(session.user.name);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const today = getTodayStr();
  const entry = await findTodayEntry(user.id, today);

  if (entry) {
    return NextResponse.json(entry);
  }

  const date = new Date();
  const formatterDay = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  });
  const weekday = formatterDay.format(date);

  if (weekday === "Mon") {
    return NextResponse.json({ isDraft: true, location: "" });
  }

  const lastEntry = await findLastEntryWithLocation(user.id);
  return NextResponse.json({ isDraft: true, location: lastEntry?.location || "" });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByUsername(session.user.name);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { action, pauseHours, travelHours, location, startTime, endTime } = body;

  const today = getTodayStr();
  const now = getCurrentTimeStr();

  let entry = body.id
    ? await findTimeEntryById(String(body.id))
    : await findTodayEntry(user.id, today);

  if (body.id && entry && entry.userId !== user.id) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if (action === "start") {
    if (entry && entry.startTime && !entry.endTime) {
      return NextResponse.json({ error: "Already started" }, { status: 400 });
    }

    const finalPause =
      pauseHours !== undefined && !isNaN(parseFloat(pauseHours))
        ? parseFloat(pauseHours)
        : 0.5;
    const finalTravel =
      travelHours !== undefined && !isNaN(parseFloat(travelHours))
        ? parseFloat(travelHours)
        : 0;

    entry = await createTimeEntry({
      userId: user.id,
      date: today,
      startTime: now,
      pauseHours: finalPause,
      travelHours: finalTravel,
      location: location || "",
    });

    return NextResponse.json(entry);
  }

  if (action === "stop") {
    if (!entry || !entry.startTime) {
      return NextResponse.json({ error: "Not started" }, { status: 400 });
    }

    const startParts = entry.startTime.split(":");
    const stopParts = now.split(":");
    const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const stopMins = parseInt(stopParts[0]) * 60 + parseInt(stopParts[1]);

    let diffMins = stopMins - startMins;
    if (diffMins < 0) diffMins += 24 * 60;
    const diffHours = diffMins / 60;
    const finalPause = parseFloat(pauseHours) || 0;
    const finalTravel = parseFloat(travelHours) || 0;
    const totalHours = Math.max(0, diffHours - finalPause - finalTravel);

    entry = await updateTimeEntry(entry.id, {
      endTime: now,
      pauseHours: finalPause,
      travelHours: finalTravel,
      location,
      totalHours: parseFloat(totalHours.toFixed(2)),
    });
    return NextResponse.json(entry);
  }

  if (action === "update") {
    if (!entry) {
      return NextResponse.json({ error: "No entry today" }, { status: 400 });
    }

    let totalHours: number | null = null;
    const finalStart = startTime !== undefined ? startTime : entry.startTime;
    const finalEnd = endTime !== undefined ? endTime : entry.endTime;
    const finalPause = parseFloat(pauseHours) || 0;
    const finalTravel = parseFloat(travelHours) || 0;

    if (finalStart && finalEnd) {
      const startParts = finalStart.split(":");
      const stopParts = finalEnd.split(":");
      const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
      const stopMins = parseInt(stopParts[0]) * 60 + parseInt(stopParts[1]);

      let diffMins = stopMins - startMins;
      if (diffMins < 0) diffMins += 24 * 60;
      const diffHours = diffMins / 60;
      totalHours = parseFloat(
        Math.max(0, diffHours - finalPause - finalTravel).toFixed(2)
      );
    }

    entry = await updateTimeEntry(entry.id, {
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      pauseHours: finalPause,
      travelHours: finalTravel,
      location,
      ...(totalHours !== null && { totalHours }),
    });
    return NextResponse.json(entry);
  }

  if (action === "delete") {
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 400 });
    }
    await deleteTimeEntry(entry.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
