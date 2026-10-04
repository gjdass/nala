/**
 * Whether `entry` is live (no end time) and started more than `ms` before `now` (epoch ms): the
 * "Still …?" warning of a section with a timer (spec 04 Timers).
 */
export function isLiveLongerThan(
  entry: { startTime: string; endTime: string | null },
  ms: number,
  now: number,
): boolean {
  return entry.endTime === null && now - Date.parse(entry.startTime) > ms;
}
