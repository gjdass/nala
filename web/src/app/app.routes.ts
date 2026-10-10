import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import {
  authGuard,
  emailResetGuard,
  invitationGuard,
  signedOutGuard,
  setupOnlyGuard,
} from './core/auth/auth.guards';
import { SECTIONS } from './core/sections/section.models';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupOnlyGuard],
    loadComponent: () => import('./features/auth/setup/setup.page').then((m) => m.SetupPage),
  },
  {
    path: 'login',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'invite/:token',
    canActivate: [invitationGuard],
    loadComponent: () =>
      import('./features/auth/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot',
    canActivate: [signedOutGuard, emailResetGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.page').then(
        (m) => m.ForgotPasswordPage,
      ),
  },
  {
    path: 'reset/:token',
    canActivate: [signedOutGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadComponent: () => import('./features/history/history.page').then((m) => m.HistoryPage),
  },
  {
    path: 'trends',
    canActivate: [authGuard],
    data: { destination: 'trends' },
    loadComponent: () =>
      import('./features/coming-soon/coming-soon.page').then((m) => m.ComingSoonPage),
  },
  {
    // The retired section history page (bookmarks): History for that section, if built.
    path: 'history/:section',
    redirectTo: ({ params }) =>
      inject(SECTIONS).some((s) => s.key === params['section'])
        ? inject(Router).createUrlTree(['/history'], {
            queryParams: { section: params['section'] },
          })
        : '/',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
