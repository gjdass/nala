import { HttpErrorResponse } from '@angular/common/http';
import { FieldErrors } from '../auth/auth.models';

/** Form-level codes the API answers with, by status. */
const FORM_ERRORS: Partial<Record<number, string>> = {
  401: 'invalidCredentials',
  429: 'tooManyAttempts',
};

/**
 * Statuses whose body carries the form code: an unusable invitation or reset link (404 unknown, 410 expired/used/revoked),
 * a refused action (403, e.g. `adminCannotDelete`), a conflict (409, e.g. `breastfeedInProgress`).
 */
const CODE_IN_BODY = [403, 404, 409, 410];

/**
 * A 400 validation problem (`{ errors: { field: [code] } }`) to one code per field; a known status
 * to its form code; anything else is `form: unknown`.
 */
export function toFieldErrors(error: HttpErrorResponse): FieldErrors {
  const problem = error.status === 400 ? (error.error?.errors as Record<string, string[]>) : null;
  if (!problem) {
    const bodyCode = CODE_IN_BODY.includes(error.status) ? (error.error?.code as string) : null;
    return { form: bodyCode ?? FORM_ERRORS[error.status] ?? 'unknown' };
  }
  return Object.fromEntries(Object.entries(problem).map(([field, codes]) => [field, codes[0]]));
}
