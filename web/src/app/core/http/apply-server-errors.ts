import { FormGroup } from '@angular/forms';
import { FieldErrors } from '../auth/auth.models';

/**
 * Puts each field code the API sent on its control, as a touched `{ server: code }` error. Answers the
 * form-level code to show: the `form` code, `unknown` when no field of the form matched, else null.
 */
export function applyServerErrors(form: FormGroup, errors: FieldErrors): string | null {
  const { form: formCode, ...fields } = errors;
  let matched = false;
  for (const [field, code] of Object.entries(fields)) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ server: code });
      control.markAsTouched();
      matched = true;
    }
  }
  return formCode ?? (matched ? null : 'unknown');
}
