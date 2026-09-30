import { ValidatorFn } from '@angular/forms';

/** How far ahead of the device clock a time may be (spec 05), like the API. */
export const FUTURE_TOLERANCE_MS = 60_000;

/** Refuses a date more than a minute ahead of `now()` with `{ inFuture: true }`; leaves an empty value alone. */
export const notInFuture =
  (now: () => number = Date.now): ValidatorFn =>
  (control) => {
    const value = control.value as Date | null;
    return value && value.getTime() > now() + FUTURE_TOLERANCE_MS ? { inFuture: true } : null;
  };
