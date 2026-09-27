import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** A failed login is the login screen's business, not an expired session. */
const LOGIN_URL = '/api/auth/login';

/** An API call answered 401 means the session is gone: forget the user and go to the login screen. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        req.url.startsWith('/api/') &&
        req.url !== LOGIN_URL
      ) {
        auth.signedOut();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
