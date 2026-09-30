import { getDb } from "@/lib/firebaseAdmin";

export type UserRole = "ADMIN" | "WORKER";

export interface UserRecord {
  id: string;
  username: string;
  usernameLower: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
  annualLeaveDays: number;
  carriedOverLeaveDays: number;
  lastCarryOverYear: number;
  entryDate: string | null;
  createdAt: string; // ISO
}

export interface LeaveRequestRecord {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
  createdAt: string; // ISO
  username?: string;
}

export interface TimeEntryRecord {
  id: string;
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  pauseHours: number;
  travelHours: number;
  totalHours: number | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

const USERS = "users";
const LEAVES = "leaveRequests";
const ENTRIES = "timeEntries";

function usersCol() {
  return getDb().collection(USERS);
}
function leavesCol() {
  return getDb().collection(LEAVES);
}
function entriesCol() {
  return getDb().collection(ENTRIES);
}

type DocData = Record<string, any>;

function toUser(id: string, data: DocData): UserRecord {
  return {
    id,
    username: data.username,
    usernameLower: data.usernameLower || String(data.username || "").toLowerCase(),
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    password: data.password,
    role: data.role,
    annualLeaveDays: data.annualLeaveDays ?? 30,
    carriedOverLeaveDays: data.carriedOverLeaveDays ?? 0,
    lastCarryOverYear: data.lastCarryOverYear ?? new Date().getFullYear(),
    entryDate: data.entryDate ?? null,
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

function toLeave(id: string, data: DocData): LeaveRequestRecord {
  return {
    id,
    userId: data.userId,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    daysCount: data.daysCount ?? 0,
    status: data.status,
    createdAt: data.createdAt || new Date().toISOString(),
    username: data.username,
  };
}

function toEntry(id: string, data: DocData): TimeEntryRecord {
  return {
    id,
    userId: data.userId,
    date: data.date,
    startTime: data.startTime ?? null,
    endTime: data.endTime ?? null,
    pauseHours: data.pauseHours ?? 0.5,
    travelHours: data.travelHours ?? 0,
    totalHours: data.totalHours ?? null,
    location: data.location ?? null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const snap = await usersCol()
    .where("usernameLower", "==", username.toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return toUser(doc.id, doc.data());
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const doc = await usersCol().doc(id).get();
  if (!doc.exists) return null;
  return toUser(doc.id, doc.data()!);
}

export async function createUser(input: {
  username: string;
  firstName?: string;
  lastName?: string;
  password: string;
  role: UserRole;
  annualLeaveDays?: number;
  entryDate?: string | null;
  carriedOverLeaveDays?: number;
  lastCarryOverYear?: number;
  createdAt?: string;
  id?: string;
}): Promise<UserRecord> {
  const now = new Date().toISOString();
  const ref = input.id ? usersCol().doc(input.id) : usersCol().doc();
  const data = {
    username: input.username,
    usernameLower: input.username.toLowerCase(),
    firstName: input.firstName?.trim() || "",
    lastName: input.lastName?.trim() || "",
    password: input.password,
    role: input.role,
    annualLeaveDays: input.annualLeaveDays ?? 30,
    carriedOverLeaveDays: input.carriedOverLeaveDays ?? 0,
    lastCarryOverYear: input.lastCarryOverYear ?? new Date().getFullYear(),
    entryDate: input.entryDate ?? null,
    createdAt: input.createdAt || now,
  };
  await ref.set(data);
  return toUser(ref.id, data);
}

export async function updateUser(
  id: string,
  data: Partial<
    Pick<
      UserRecord,
      | "password"
      | "firstName"
      | "lastName"
      | "annualLeaveDays"
      | "carriedOverLeaveDays"
      | "lastCarryOverYear"
      | "entryDate"
    >
  >
): Promise<void> {
  await usersCol().doc(id).update(data);
}

export async function deleteUserCascade(userId: string): Promise<void> {
  const db = getDb();
  const batchSize = 400;

  async function deleteByUserId(collectionName: string) {
    while (true) {
      const snap = await db
        .collection(collectionName)
        .where("userId", "==", userId)
        .limit(batchSize)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await deleteByUserId(LEAVES);
  await deleteByUserId(ENTRIES);
  await usersCol().doc(userId).delete();
}

export async function listWorkersWithApprovedLeaves(): Promise<
  Array<
    Omit<UserRecord, "password" | "usernameLower"> & {
      leaveRequests: LeaveRequestRecord[];
    }
  >
> {
  const usersSnap = await usersCol().where("role", "==", "WORKER").get();
  const leavesSnap = await leavesCol().where("status", "==", "APPROVED").get();

  const leavesByUser = new Map<string, LeaveRequestRecord[]>();
  leavesSnap.docs.forEach((doc) => {
    const leave = toLeave(doc.id, doc.data());
    const list = leavesByUser.get(leave.userId) || [];
    list.push(leave);
    leavesByUser.set(leave.userId, list);
  });

  return usersSnap.docs.map((doc) => {
    const user = toUser(doc.id, doc.data());
    const { password: _p, usernameLower: _u, ...rest } = user;
    return {
      ...rest,
      leaveRequests: leavesByUser.get(user.id) || [],
    };
  });
}

export async function listLeaveRequestsForUser(userId: string): Promise<LeaveRequestRecord[]> {
  const snap = await leavesCol().where("userId", "==", userId).get();
  return snap.docs
    .map((d) => toLeave(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPendingLeaves(): Promise<LeaveRequestRecord[]> {
  const snap = await leavesCol().where("status", "==", "PENDING").get();
  const items = snap.docs.map((d) => toLeave(d.id, d.data()));
  // Attach username for admin UI
  const userIds = [...new Set(items.map((i) => i.userId))];
  const users = await Promise.all(userIds.map((id) => findUserById(id)));
  const nameById = new Map(users.filter(Boolean).map((u) => [u!.id, u!.username]));
  return items
    .map((item) => ({
      ...item,
      username: nameById.get(item.userId),
      user: { username: nameById.get(item.userId) },
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createLeaveRequest(input: {
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
  username?: string;
}): Promise<LeaveRequestRecord> {
  const ref = leavesCol().doc();
  const createdAt = new Date().toISOString();
  const data = { ...input, createdAt };
  await ref.set(data);
  return toLeave(ref.id, data);
}

export async function findLeaveById(id: string): Promise<LeaveRequestRecord | null> {
  const doc = await leavesCol().doc(id).get();
  if (!doc.exists) return null;
  return toLeave(doc.id, doc.data()!);
}

export async function updateLeaveStatus(id: string, status: string): Promise<LeaveRequestRecord> {
  await leavesCol().doc(id).update({ status });
  const leave = await findLeaveById(id);
  if (!leave) throw new Error("Leave not found after update");
  return leave;
}

export async function deleteLeave(id: string): Promise<void> {
  await leavesCol().doc(id).delete();
}

export async function listTimeEntriesForUser(userId: string): Promise<TimeEntryRecord[]> {
  const snap = await entriesCol().where("userId", "==", userId).get();
  return snap.docs
    .map((d) => toEntry(d.id, d.data()))
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export async function findTodayEntry(userId: string, date: string): Promise<TimeEntryRecord | null> {
  const snap = await entriesCol()
    .where("userId", "==", userId)
    .where("date", "==", date)
    .limit(5)
    .get();
  if (snap.empty) return null;
  const entries = snap.docs.map((d) => toEntry(d.id, d.data()));
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries[0] || null;
}

export async function findLastEntryWithLocation(userId: string): Promise<TimeEntryRecord | null> {
  const entries = await listTimeEntriesForUser(userId);
  return entries.find((e) => e.location && e.location.trim() !== "") || null;
}

export async function findTimeEntryById(id: string): Promise<TimeEntryRecord | null> {
  const doc = await entriesCol().doc(id).get();
  if (!doc.exists) return null;
  return toEntry(doc.id, doc.data()!);
}

export async function createTimeEntry(input: {
  userId: string;
  date: string;
  startTime: string;
  pauseHours: number;
  travelHours: number;
  location: string;
}): Promise<TimeEntryRecord> {
  const ref = entriesCol().doc();
  const now = new Date().toISOString();
  const data = {
    ...input,
    endTime: null,
    totalHours: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(data);
  return toEntry(ref.id, data);
}

export async function updateTimeEntry(
  id: string,
  data: Partial<
    Pick<
      TimeEntryRecord,
      "startTime" | "endTime" | "pauseHours" | "travelHours" | "totalHours" | "location"
    >
  >
): Promise<TimeEntryRecord> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  await entriesCol().doc(id).update(payload);
  const entry = await findTimeEntryById(id);
  if (!entry) throw new Error("Entry not found after update");
  return entry;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await entriesCol().doc(id).delete();
}

export async function listTimeEntrySummaries(
  userId: string
): Promise<Array<{ date: string; totalHours: number | null }>> {
  const entries = await listTimeEntriesForUser(userId);
  return entries.map((e) => ({ date: e.date, totalHours: e.totalHours }));
}
