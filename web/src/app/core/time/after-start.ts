import { ValidatorFn } from '@angular/forms';

/**
 * Refuses an end time that isn't after `start()` with `{ beforeStart: true }` (spec 04: a 0-minute
 * entry is refused too); leaves empty values alone.
 */
export const afterStart =
  (start: () => Date | null): ValidatorFn =>
  (control) => {
    const end = control.value as Date | null;
    const from = start();
    return end && from && end.getTime() <= from.getTime() ? { beforeStart: true } : null;
  };
