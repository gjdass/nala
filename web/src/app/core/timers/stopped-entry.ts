import { UserName } from '../entries/entry.models';

/** What `stoppedEntry` needs of an entry with a timer (spec 04 Timers). */
interface StoppableEntry {
  startTime: string;
  endTime: string | null;
  updatedBy: UserName;
  updatedAt: string;
}

/**
 * `entry` once stopped at `at` (ISO date-time) by `user`: ended then, no longer live, its other fields
 * kept. A stopped entry, or a time before its start, changes nothing.
 */
export function stoppedEntry<T extends StoppableEntry>(
  entry: T,
  at: string,
  user: UserName = entry.updatedBy,
): T {
  if (entry.endTime !== null || Date.parse(at) < Date.parse(entry.startTime)) {
    return entry;
  }
  return { ...entry, endTime: at, updatedBy: user, updatedAt: at };
}
