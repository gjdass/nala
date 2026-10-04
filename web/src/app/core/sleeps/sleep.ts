import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { stoppedEntry } from '../timers/stopped-entry';
import { Sleep } from './sleep.models';

const TIMER_URL = /^\/api\/sleeps\/([^/]+)\/(start|stop)$/;
const SLEEP_URL = /^\/api\/sleeps\/([^/]+)$/;

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
  notes: string | null;
}

/**
 * The live sleeps once `requests` (the user's changes waiting on the device, oldest first) are
 * applied to `sleeps`, following the server's rules (spec 06): a start creates the sleep live (start
 * time = its time, kept next to another live one: it was queued) or makes a stopped one live again; a
 * stop or a delete ends it; an edit changes its start time and notes (and the end time of a stopped
 * one). A tap the sleep already has (started while live, stopped while stopped, or a time before its
 * start) changes nothing, so applying the same requests again is harmless. A sleep created here is
 * logged by `user`. Only live sleeps are returned.
 */
export function applyQueuedSleeps(
  sleeps: readonly Sleep[],
  requests: readonly QueuedRequest[],
  user: UserName,
): Sleep[] {
  let list = [...sleeps];
  const replace = (sleep: Sleep) =>
    (list = list.some((s) => s.id === sleep.id)
      ? list.map((s) => (s.id === sleep.id ? sleep : s))
      : [...list, sleep]);
  for (const request of requests) {
    const timer = request.method === 'POST' ? TIMER_URL.exec(request.url) : null;
    if (timer) {
      const [, id, action] = timer;
      const sleep = list.find((s) => s.id === id);
      if (action === 'start') {
        replace(started(sleep, id, request.body as StartBody, user));
      } else if (sleep) {
        replace(stoppedEntry(sleep, (request.body as StopBody).at, user));
      }
      continue;
    }
    const entry = SLEEP_URL.exec(request.url);
    const sleep = entry && list.find((s) => s.id === entry[1]);
    if (!sleep) {
      continue;
    }
    if (request.method === 'DELETE') {
      list = list.filter((s) => s.id !== sleep.id);
    } else if (request.method === 'PUT') {
      const edit = request.body as EditBody;
      // A live sleep takes no end time: the server refuses the edit.
      if (sleep.endTime === null && edit.endTime !== null) {
        continue;
      }
      replace({
        ...sleep,
        startTime: edit.startTime,
        endTime: edit.endTime,
        notes: edit.notes?.trim() || null,
        updatedBy: user,
        updatedAt: request.queuedAt,
      });
    }
  }
  return list.filter((sleep) => sleep.endTime === null);
}

function started(sleep: Sleep | undefined, id: string, body: StartBody, user: UserName): Sleep {
  if (!sleep) {
    return {
      id,
      babyId: body.babyId,
      startTime: body.at,
      endTime: null,
      notes: null,
      loggedBy: user,
      updatedBy: user,
      createdAt: body.at,
      updatedAt: body.at,
    };
  }
  if (sleep.endTime === null || Date.parse(body.at) < Date.parse(sleep.startTime)) {
    return sleep;
  }
  return { ...sleep, endTime: null, updatedBy: user, updatedAt: body.at };
}
