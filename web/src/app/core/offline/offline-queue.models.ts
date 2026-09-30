import { HttpErrorResponse } from '@angular/common/http';

/** The requests the device can keep for later: adding, replacing or deleting an entry. */
export type QueuedMethod = 'POST' | 'PUT' | 'DELETE';

/** A request kept on the device until it reaches the server, sent as the user who made it only. */
export interface QueuedRequest {
  /** Identifies the queued request itself, not the entry. */
  id: string;
  userId: string;
  method: QueuedMethod;
  url: string;
  body: unknown;
  /** ISO date-time (UTC) of the action on the device. */
  queuedAt: string;
}

/** Sent now (with the server's answer), kept on the device for later, or refused by the server. */
export type SendOutcome<T> = { sent: T } | { queued: true } | { error: HttpErrorResponse };

export interface SendOptions {
  /** The body kept on the device instead of `body`, when the request has to wait. */
  queuedBody?: unknown;
  /** Says it was kept only when nothing of the user was waiting yet (e.g. repeated timer taps). */
  quiet?: boolean;
}
