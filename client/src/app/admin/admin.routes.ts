import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { AdminSessionStore } from './admin-session-store';
import { adminLoginPath, upcomingAdminSections } from './admin.config';

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
    canActivate: [requireAdmin],
    loadComponent: () => import('./admin-shell').then((module) => module.AdminShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Admin dashboard | Apaar Garage',
        loadComponent: () => import('./admin-dashboard').then((module) => module.AdminDashboard),
      },
      {
        path: 'products',
        title: 'Products | Apaar Garage Admin',
        loadChildren: () =>
          import('./products/admin-products.routes').then((module) => module.adminProductRoutes),
      },
      {
        path: 'product-import',
        pathMatch: 'full',
        title: 'Import products | Apaar Garage Admin',
        loadComponent: () =>
          import('./products/import/product-import-page').then(
            (module) => module.ProductImportPage,
          ),
      },
      {
        path: 'product-import/history',
        title: 'Import history | Apaar Garage Admin',
        loadComponent: () =>
          import('./products/import/product-import-history').then(
            (module) => module.ProductImportHistory,
          ),
      },
      {
        path: 'orders',
        title: 'Orders | Apaar Garage Admin',
        loadComponent: () => import('./admin-packing-slip').then((module) => module.AdminPackingSlip),
      },
      ...upcomingAdminSections.map(({ segment, label }) => ({
        path: segment,
        title: label + ' | Apaar Garage Admin',
        data: { label },
        loadComponent: () => import('./admin-section').then((module) => module.AdminSection),
      })),
      { path: '**', redirectTo: '' },
    ],
  },
];
