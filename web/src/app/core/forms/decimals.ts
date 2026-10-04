import { ValidatorFn } from '@angular/forms';

/** At most `digits` decimals (`{ decimals: true }` otherwise); leaves an empty value alone. */
export const decimals =
  (digits: number): ValidatorFn =>
  (control) => {
    const value = control.value as number | null;
    const factor = 10 ** digits;
    return value === null || Math.round(value * factor) / factor === value
      ? null
      : { decimals: true };
  };
