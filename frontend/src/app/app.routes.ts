import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell';
import { authGuard } from './core/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'secao/:nome',
        loadComponent: () => import('./inventory/inventory').then((m) => m.InventoryComponent),
      },
      {
        path: 'config',
        loadComponent: () => import('./settings/settings').then((m) => m.SettingsComponent),
      },
      { path: '', redirectTo: 'secao/Notebooks', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
