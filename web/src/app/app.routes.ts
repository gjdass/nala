import { Routes } from '@angular/router';
import { setupOnlyGuard, setupRequiredGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupOnlyGuard],
    loadComponent: () => import('./features/auth/setup/setup.page').then((m) => m.SetupPage),
  },
  {
    path: '',
    canActivate: [setupRequiredGuard],
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
