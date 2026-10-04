/**
 * The whole seconds from an entry's start to its end, or to `now` (epoch ms) while it has no end
 * (live); null for a live entry without `now`. Shared by the sections with a start and an end
 * (Sleep, Pump).
 */
export function spanSeconds(
  entry: { startTime: string; endTime: string | null },
  now?: number,
): number | null {
  const end = entry.endTime === null ? now : Date.parse(entry.endTime);
  return end === undefined ? null : Math.floor((end - Date.parse(entry.startTime)) / 1000);
}
