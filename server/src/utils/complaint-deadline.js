import { resolutionMonths, resolutionMs } from '../config/store-policy.js';

export function complaintDueAt(at) {
  // Use the shorter of 30 days and one calendar month, clamped to the month end.
  const monthEnd = new Date(at);
  monthEnd.setUTCDate(1);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + resolutionMonths + 1, 0);
  monthEnd.setUTCDate(Math.min(at.getUTCDate(), monthEnd.getUTCDate()));
  return new Date(Math.min(+at + resolutionMs, +monthEnd));
}
