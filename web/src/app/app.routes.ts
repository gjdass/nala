import { Routes } from '@angular/router';
import { authGuard, loginOnlyGuard, setupOnlyGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupOnlyGuard],
    loadComponent: () => import('./features/auth/setup/setup.page').then((m) => m.SetupPage),
  },
  {
    path: 'login',
    canActivate: [loginOnlyGuard],
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
