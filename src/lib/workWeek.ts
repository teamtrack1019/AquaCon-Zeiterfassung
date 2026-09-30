const BERLIN = "Europe/Berlin";

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export function berlinYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function berlinWeekdayIndex(date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BERLIN,
    weekday: "short",
  }).format(date);
  return WEEKDAY_INDEX[weekday] ?? 0;
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentWorkWeekBounds(now = new Date()): { start: string; end: string } {
  const today = berlinYmd(now);
  const start = addDays(today, -berlinWeekdayIndex(now));
  return { start, end: addDays(start, 6) };
}

/** Monday–Sunday of the current week in Europe/Berlin. Sunday is the last editable day. */
export function isDateInCurrentWorkWeek(dateStr: string | null | undefined, now = new Date()): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const { start, end } = currentWorkWeekBounds(now);
  return dateStr >= start && dateStr <= end;
}
