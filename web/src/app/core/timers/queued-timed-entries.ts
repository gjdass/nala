import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { stoppedEntry } from './stopped-entry';

/** What every entry with a single Start / Stop timer has (spec 04 Timers: Sleep, Pump). */
export interface TimedEntry {
  id: string;
  babyId: string;
  startTime: string;
  endTime: string | null;
  loggedBy: UserName;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** What a section adds to the shared rules of `applyQueuedTimedEntries`. */
export interface TimedEntryRules<T extends TimedEntry> {
  /** The section's path in the API (`/api/<path>/{id}`, `/api/<path>/{id}/start|stop`). */
  path: string;
  /** The section's own fields of an entry created by a Start, nothing typed yet. */
  blank: Omit<T, keyof TimedEntry>;
  /** The section's own fields an edit (PUT, its body) sets, besides the start and end times. */
  edited(body: unknown): Omit<T, keyof TimedEntry>;
}

interface StartBody {
  babyId: string;
  at: string;
}

interface StopBody {
  at: string;
}

interface EditBody {
  startTime: string;
  endTime: string | null;
}

/**
 * The live entries once `requests` (the user's changes waiting on the device, oldest first) are
 * applied to `entries`, following the server's rules (spec 04 Timers): a start creates the entry live
 * (start time = its time, kept next to another live one: it was queued) or makes a stopped one live
 * again; a stop or a delete ends it; an edit changes its start time and the section's fields (and the
 * end time of a stopped one). A tap the entry already has (started while live, stopped while stopped,
 * or a time before its start) changes nothing, so applying the same requests again is harmless. An
 * entry created here is logged by `user`. Only live entries are returned.
 */
export function applyQueuedTimedEntries<T extends TimedEntry>(
  entries: readonly T[],
  requests: readonly QueuedRequest[],
  user: UserName,
  rules: TimedEntryRules<T>,
): T[] {
  const timerUrl = new RegExp(`^/api/${rules.path}/([^/]+)/(start|stop)$`);
  const entryUrl = new RegExp(`^/api/${rules.path}/([^/]+)$`);
  let list = [...entries];
  const replace = (entry: T) =>
    (list = list.some((e) => e.id === entry.id)
      ? list.map((e) => (e.id === entry.id ? entry : e))
      : [...list, entry]);
  for (const request of requests) {
    const timer = request.method === 'POST' ? timerUrl.exec(request.url) : null;
    if (timer) {
      const [, id, action] = timer;
      const entry = list.find((e) => e.id === id);
      if (action === 'start') {
        replace(started(entry, id, request.body as StartBody, user, rules));
      } else if (entry) {
        replace(stoppedEntry(entry, (request.body as StopBody).at, user));
      }
      continue;
    }
    const match = entryUrl.exec(request.url);
    const entry = match && list.find((e) => e.id === match[1]);
    if (!entry) {
      continue;
    }
    if (request.method === 'DELETE') {
      list = list.filter((e) => e.id !== entry.id);
    } else if (request.method === 'PUT') {
      const edit = request.body as EditBody;
      // A live entry takes no end time: the server refuses the edit.
      if (entry.endTime === null && edit.endTime !== null) {
        continue;
      }
      replace({
        ...entry,
        ...rules.edited(request.body),
        startTime: edit.startTime,
        endTime: edit.endTime,
        updatedBy: user,
        updatedAt: request.queuedAt,
      });
    }
  }
  return list.filter((entry) => entry.endTime === null);
}

function started<T extends TimedEntry>(
  entry: T | undefined,
  id: string,
  body: StartBody,
  user: UserName,
  rules: TimedEntryRules<T>,
): T {
  if (!entry) {
    return {
      ...rules.blank,
      id,
      babyId: body.babyId,
      startTime: body.at,
      endTime: null,
      loggedBy: user,
      updatedBy: user,
      createdAt: body.at,
      updatedAt: body.at,
    } as T;
  }
  if (entry.endTime === null || Date.parse(body.at) < Date.parse(entry.startTime)) {
    return entry;
  }
  return { ...entry, endTime: null, updatedBy: user, updatedAt: body.at };
}
