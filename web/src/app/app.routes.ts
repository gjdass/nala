import { Routes } from '@angular/router';
import { authGuard, signedOutGuard, setupOnlyGuard } from './core/auth/auth.guards';

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
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
