import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGermanHolidayName } from "@/lib/holidays";
import {
  createLeaveRequest,
  findUserByUsername,
  listLeaveRequestsForUser,
  listTimeEntrySummaries,
  updateUser,
} from "@/lib/db";

function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  const [sY, sM, sD] = startDateStr.split("-").map(Number);
  const [eY, eM, eD] = endDateStr.split("-").map(Number);
  const start = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);
  let count = 0;

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const y = current.getFullYear();
      const m = (current.getMonth() + 1).toString().padStart(2, "0");
      const d = current.getDate().toString().padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      if (!getGermanHolidayName(dateStr)) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByUsername(session.user.name);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const leaveRequests = await listLeaveRequestsForUser(user.id);
  const timeEntries = await listTimeEntrySummaries(user.id);

  const currentYear = new Date().getFullYear();
  let lastCarryOverYear = user.lastCarryOverYear;
  let carriedOverLeaveDays = user.carriedOverLeaveDays;

  if (lastCarryOverYear < currentYear) {
    const pastApprovedUrlaub = leaveRequests
      .filter(
        (l) =>
          l.type === "URLAUB" &&
          l.status === "APPROVED" &&
          new Date(l.createdAt).getFullYear() === lastCarryOverYear
      )
      .reduce((sum, l) => sum + l.daysCount, 0);

    const rest = user.annualLeaveDays + carriedOverLeaveDays - pastApprovedUrlaub;
    const finalCarryOver = rest > 0 ? rest : 0;

    await updateUser(user.id, {
      lastCarryOverYear: currentYear,
      carriedOverLeaveDays: finalCarryOver,
    });

    lastCarryOverYear = currentYear;
    carriedOverLeaveDays = finalCarryOver;
  }

  const { calculateZeitkonto } = await import("@/lib/zeitkonto");
  const zeitkonto = calculateZeitkonto(timeEntries);

  const { password: _password, usernameLower: _ul, ...safeUser } = user;

  return NextResponse.json({
    ...safeUser,
    lastCarryOverYear,
    carriedOverLeaveDays,
    leaveRequests,
    timeEntries,
    zeitkonto,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByUsername(session.user.name);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { type, startDate, endDate } = await req.json();

  if (!type || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const daysCount = calculateWorkingDays(startDate, endDate);
  if (daysCount === 0) {
    return NextResponse.json(
      { error: "Seçilen tarihler arasında iş günü bulunmuyor." },
      { status: 400 }
    );
  }

  const status = type === "KRANK" ? "APPROVED" : "PENDING";

  const leaveRequest = await createLeaveRequest({
    userId: user.id,
    type,
    startDate,
    endDate,
    daysCount,
    status,
    username: user.username,
  });

  return NextResponse.json(leaveRequest);
}
