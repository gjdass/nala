import { AbstractControl } from '@angular/forms';

/** The code to show for a control: a server-side code set as `{ server: code }`, else the first validator key. */
export function errorCode(control: AbstractControl): string | null {
  const errors = control.errors;
  if (!errors) {
    return null;
  }
  return 'server' in errors ? (errors['server'] as string) : Object.keys(errors)[0];
}
