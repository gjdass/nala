import { Routes } from '@angular/router';
import {
  authGuard,
  emailResetGuard,
  signedOutGuard,
  setupOnlyGuard,
} from './core/auth/auth.guards';
import { registeredSectionGuard } from './core/sections/section.guards';

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
    canActivate: [signedOutGuard],
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
      import('./features/auth/reset-password/reset-password.page').then(
        (m) => m.ResetPasswordPage,
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'history/:section',
    canActivate: [authGuard, registeredSectionGuard],
    loadComponent: () => import('./features/history/history.page').then((m) => m.HistoryPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
