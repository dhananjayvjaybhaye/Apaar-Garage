import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { AdminSessionStore } from './admin-session-store';
import { adminLoginPath } from './admin.config';

const requireAdmin: CanActivateFn = async () => {
  const sessions = inject(AdminSessionStore);
  const router = inject(Router);
  const session = await sessions.restore();
  return session && !session.setupRequired ? true : router.parseUrl(adminLoginPath);
};

export const adminRoutes: Routes = [
  {
    path: 'login',
    title: 'Admin sign-in | Apaar Garage',
    loadComponent: () => import('./admin-login').then((module) => module.AdminLogin),
  },
  {
    path: '',
    pathMatch: 'full',
    title: 'Admin dashboard | Apaar Garage',
    canActivate: [requireAdmin],
    loadComponent: () => import('./admin-dashboard').then((module) => module.AdminDashboard),
  },
  { path: '**', redirectTo: '' },
];
