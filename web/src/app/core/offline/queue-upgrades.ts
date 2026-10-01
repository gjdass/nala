import { QueuedRequest } from './offline-queue.models';

const FINISH_URL = /^\/api\/feeds\/([^/]+)\/breastfeed\/finish$/;

interface FinishBody {
  startTime: string;
  notes: string | null;
  at: string;
}

/**
 * Requests kept on the device by an older version of the app, rewritten for today's API. A
 * breastfeed finish (removed by spec 05 "live or not") becomes a Stop at the same time, then the
 * start time and notes as an edit; both keep the original request's user and time.
 */
export function upgradeQueued(requests: readonly QueuedRequest[]): QueuedRequest[] {
  return requests.flatMap((request) => {
    const finish = request.method === 'POST' ? FINISH_URL.exec(request.url) : null;
    if (!finish) {
      return [request];
    }
    const { startTime, notes, at } = request.body as FinishBody;
    return [
      {
        ...request,
        id: `${request.id}-stop`,
        url: `/api/feeds/${finish[1]}/breastfeed/stop`,
        body: { at },
      },
      {
        ...request,
        id: `${request.id}-edit`,
        method: 'PUT',
        url: `/api/feeds/${finish[1]}`,
        body: { startTime, notes },
      },
    ];
  });
}
