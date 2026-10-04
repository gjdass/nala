import { ValidatorFn } from '@angular/forms';
import { localDate } from './measurement';

/** The local midnight of the current day: a growth entry's date when adding (spec 10). */
export const today = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Not before the `yyyy-MM-dd` birth date `birthDate()` (none known: no check). */
export const notBeforeBirth =
  (birthDate: () => string | null): ValidatorFn =>
  (control) => {
    const value = control.value as Date | null;
    const birth = birthDate();
    return value && birth && value < localDate(birth) ? { beforeBirth: true } : null;
  };
