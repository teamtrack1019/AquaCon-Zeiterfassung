// German Public Holidays (Gesetzliche Feiertage in Deutschland)

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a map of DateString (YYYY-MM-DD) -> Feiertagsname
 * for nationwide German public holidays in the given year.
 */
export function getGermanHolidays(year: number): Record<string, string> {
  const holidays: Record<string, string> = {};

  const easterSunday = getEasterSunday(year);
  const karfreitag = addDays(easterSunday, -2);
  const ostermontag = addDays(easterSunday, 1);
  const christiHimmelfahrt = addDays(easterSunday, 39);
  const pfingstmontag = addDays(easterSunday, 50);

  // Feste Feiertage (bundesweit)
  holidays[`${year}-01-01`] = 'Neujahr';
  holidays[`${year}-05-01`] = 'Tag der Arbeit';
  holidays[`${year}-10-03`] = 'Tag der Deutschen Einheit';
  holidays[`${year}-12-25`] = '1. Weihnachtstag';
  holidays[`${year}-12-26`] = '2. Weihnachtstag';

  // Bewegliche Feiertage (bundesweit)
  holidays[formatDate(karfreitag)] = 'Karfreitag';
  holidays[formatDate(ostermontag)] = 'Ostermontag';
  holidays[formatDate(christiHimmelfahrt)] = 'Christi Himmelfahrt';
  holidays[formatDate(pfingstmontag)] = 'Pfingstmontag';

  return holidays;
}

/**
 * Check if a given date string (YYYY-MM-DD) is a German public holiday.
 */
export function getGermanHolidayName(dateStr: string): string | null {
  if (!dateStr || dateStr.length < 10) return null;
  const year = parseInt(dateStr.substring(0, 4));
  if (isNaN(year)) return null;
  const holidays = getGermanHolidays(year);
  return holidays[dateStr] || null;
}
