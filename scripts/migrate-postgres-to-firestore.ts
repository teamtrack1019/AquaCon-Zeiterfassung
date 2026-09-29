/**
 * One-time migration: Postgres (old) → Firestore (new).
 *
 * Requires:
 *   DATABASE_URL
 *   FIREBASE_SERVICE_ACCOUNT_JSON (or PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY)
 *
 * Usage:
 *   npx tsx scripts/migrate-postgres-to-firestore.ts
 */
import { Client } from "pg";
import {
  createLeaveRequest,
  createTimeEntry,
  createUser,
  findUserByUsername,
  updateTimeEntry,
} from "../src/lib/db";

async function main() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DIRECT_URL is required for migration");
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const users = (
    await client.query(
      `SELECT id, username, password, role, "annualLeaveDays", "carriedOverLeaveDays", "lastCarryOverYear", "entryDate", "createdAt" FROM "User"`
    )
  ).rows;

  const idMap = new Map<number, string>();

  for (const u of users) {
    const existing = await findUserByUsername(u.username);
    if (existing) {
      idMap.set(u.id, existing.id);
      console.log(`skip user ${u.username} (exists as ${existing.id})`);
      continue;
    }
    const created = await createUser({
      username: u.username,
      password: u.password,
      role: u.role === "ADMIN" ? "ADMIN" : "WORKER",
      annualLeaveDays: Number(u.annualLeaveDays ?? 30),
      carriedOverLeaveDays: Number(u.carriedOverLeaveDays ?? 0),
      lastCarryOverYear: Number(u.lastCarryOverYear ?? new Date().getFullYear()),
      entryDate: u.entryDate || null,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    });
    idMap.set(u.id, created.id);
    console.log(`migrated user ${u.username} → ${created.id}`);
  }

  const leaves = (
    await client.query(
      `SELECT id, "userId", type, "startDate", "endDate", "daysCount", status, "createdAt" FROM "LeaveRequest"`
    )
  ).rows;

  for (const l of leaves) {
    const userId = idMap.get(l.userId);
    if (!userId) {
      console.warn(`skip leave ${l.id}: missing user ${l.userId}`);
      continue;
    }
    await createLeaveRequest({
      userId,
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      daysCount: Number(l.daysCount),
      status: l.status,
    });
  }
  console.log(`migrated ${leaves.length} leave requests`);

  const entries = (
    await client.query(
      `SELECT id, "userId", date, "startTime", "endTime", "pauseHours", "travelHours", "totalHours", location, "createdAt", "updatedAt" FROM "TimeEntry"`
    )
  ).rows;

  for (const e of entries) {
    const userId = idMap.get(e.userId);
    if (!userId) {
      console.warn(`skip entry ${e.id}: missing user ${e.userId}`);
      continue;
    }
    const created = await createTimeEntry({
      userId,
      date: e.date,
      startTime: e.startTime || "00:00",
      pauseHours: Number(e.pauseHours ?? 0.5),
      travelHours: Number(e.travelHours ?? 0),
      location: e.location || "",
    });
    await updateTimeEntry(created.id, {
      startTime: e.startTime || null,
      endTime: e.endTime || null,
      pauseHours: Number(e.pauseHours ?? 0.5),
      travelHours: Number(e.travelHours ?? 0),
      totalHours: e.totalHours === null || e.totalHours === undefined ? null : Number(e.totalHours),
      location: e.location || "",
    });
  }
  console.log(`migrated ${entries.length} time entries`);

  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
