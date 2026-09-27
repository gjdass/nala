import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Same rules as the API (Nala.Core/Auth). Error keys are the API's error codes, so both map to
// the same translations: auth.errors.<field>.<code>.

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const EMAIL_MAX_LENGTH = 254;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;

const text = (control: AbstractControl): string => (control.value ?? '') as string;

export const email: ValidatorFn = (control): ValidationErrors | null => {
  const value = text(control).trim();
  if (!value) {
    return { required: true };
  }
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_SHAPE.test(value) ? null : { invalid: true };
};

export const displayName: ValidatorFn = (control): ValidationErrors | null => {
  const value = text(control).trim();
  if (!value) {
    return { required: true };
  }
  return value.length <= DISPLAY_NAME_MAX_LENGTH ? null : { tooLong: true };
};

/** Length is the only rule; spaces count. */
export const newPassword: ValidatorFn = (control): ValidationErrors | null => {
  const value = text(control);
  if (!value) {
    return { required: true };
  }
  return value.length >= PASSWORD_MIN_LENGTH ? null : { tooShort: true };
};

/** The code to show for a control: a server-side code set as `{ server: code }`, else the first validator key. */
export function errorCode(control: AbstractControl): string | null {
  const errors = control.errors;
  if (!errors) {
    return null;
  }
  return 'server' in errors ? (errors['server'] as string) : Object.keys(errors)[0];
}
