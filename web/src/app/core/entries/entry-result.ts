import { FieldErrors } from '../auth/auth.models';
import { toFieldErrors } from '../http/field-errors';
import { SendOutcome } from '../offline/offline-queue.models';

/** Saved (with the entry), kept on the device to be sent once back online (`queued`), or refused. */
export type EntryResult<T> =
  | { ok: true; queued?: false; entry: T }
  | { ok: true; queued: true }
  | { ok: false; errors: FieldErrors };

/** Deleted, kept on the device to be sent once back online (`queued`), or refused. */
export type EntryDeleteResult = { ok: true; queued?: true } | { ok: false; errors: FieldErrors };

/** A request sent through the offline queue, as the result a sheet acts on. */
export function toEntryResult<T>(outcome: SendOutcome<T>): EntryResult<T> {
  if ('error' in outcome) {
    return { ok: false, errors: toFieldErrors(outcome.error) };
  }
  return 'queued' in outcome ? { ok: true, queued: true } : { ok: true, entry: outcome.sent };
}

/** A delete sent through the offline queue, as the result a sheet acts on. */
export function toDeleteResult(outcome: SendOutcome<unknown>): EntryDeleteResult {
  if ('error' in outcome) {
    return { ok: false, errors: toFieldErrors(outcome.error) };
  }
  return 'queued' in outcome ? { ok: true, queued: true } : { ok: true };
}
