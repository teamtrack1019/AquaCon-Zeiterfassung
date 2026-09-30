export function computeTotalHours(
  start: string | null | undefined,
  end: string | null | undefined,
  pauseHours: number,
  travelHours: number
): number | null {
  if (!start || !end) return null;
  const startParts = start.split(":");
  const endParts = end.split(":");
  if (startParts.length < 2 || endParts.length < 2) return null;
  const startMins = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
  const endMins = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
  if (Number.isNaN(startMins) || Number.isNaN(endMins)) return null;
  let diffMins = endMins - startMins;
  if (diffMins < 0) diffMins += 24 * 60;
  return parseFloat(Math.max(0, diffMins / 60 - pauseHours - travelHours).toFixed(2));
}
