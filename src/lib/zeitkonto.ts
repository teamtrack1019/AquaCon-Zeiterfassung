export interface MonthZeitkontoSummary {
  month: string; // "YYYY-MM"
  grossHours: number;
  deduction: number;
  netHours: number;
  cumulativeBalance: number;
}

export interface ZeitkontoResult {
  currentBalance: number;
  maxBalance: number;
  months: Record<string, MonthZeitkontoSummary>;
}

export function calculateZeitkonto(
  entries: Array<{ date?: string; totalHours?: number | null }>,
  maxBalance: number = 200.0,
  monthlyTransferAmount: number = 5.0
): ZeitkontoResult {
  // 1. Group entries by month (YYYY-MM)
  const monthTotals: Record<string, number> = {};
  
  entries.forEach(e => {
    if (e.date && e.totalHours && e.totalHours > 0) {
      const ym = e.date.substring(0, 7);
      monthTotals[ym] = (monthTotals[ym] || 0) + e.totalHours;
    }
  });

  // 2. Sort months chronologically ascending (e.g., 2026-01, 2026-02, ...)
  const sortedMonths = Object.keys(monthTotals).sort();

  let cumulativeBalance = 0;
  const months: Record<string, MonthZeitkontoSummary> = {};

  sortedMonths.forEach(ym => {
    const grossHours = monthTotals[ym];
    const availableCap = Math.max(0, maxBalance - cumulativeBalance);
    // Transfer up to monthlyTransferAmount (or remaining capacity up to maxBalance)
    const deduction = Math.min(monthlyTransferAmount, availableCap);
    cumulativeBalance = Math.min(maxBalance, cumulativeBalance + deduction);
    const netHours = Math.max(0, grossHours - deduction);

    months[ym] = {
      month: ym,
      grossHours: parseFloat(grossHours.toFixed(2)),
      deduction: parseFloat(deduction.toFixed(2)),
      netHours: parseFloat(netHours.toFixed(2)),
      cumulativeBalance: parseFloat(cumulativeBalance.toFixed(2)),
    };
  });

  return {
    currentBalance: parseFloat(cumulativeBalance.toFixed(2)),
    maxBalance,
    months,
  };
}
