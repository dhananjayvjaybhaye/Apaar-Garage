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
        children: [
          {
            path: '', pathMatch: 'full', title: 'Orders | Apaar Garage Admin',
            loadComponent: () => import('./orders/admin-order-list').then((module) => module.AdminOrderList),
          },
          {
            path: ':orderNumber', title: 'Order details | Apaar Garage Admin',
            loadComponent: () => import('./orders/admin-order-detail').then((module) => module.AdminOrderDetail),
          },
          {
            path: ':orderNumber/packing-slip', title: 'Packing slip | Apaar Garage Admin',
            loadComponent: () => import('./admin-packing-slip').then((module) => module.AdminPackingSlip),
          },
          {
            path: ':orderNumber/invoice', title: 'Order invoice | Apaar Garage Admin',
            data: { adminInvoice: true },
            loadComponent: () => import('../orders/order-invoice').then((module) => module.OrderInvoice),
          },
        ],
      },
      {
        path: 'settings',
        title: 'Settings | Apaar Garage Admin',
        loadComponent: () => import('./settings/admin-settings').then((module) => module.AdminSettings),
      },
      {
        path: 'returns',
        title: 'Returns | Apaar Garage Admin',
        loadComponent: () => import('./returns/admin-returns').then((module) => module.AdminReturns),
      },
      {
        path: 'returns/:id',
        title: 'Return details | Apaar Garage Admin',
        loadComponent: () => import('./returns/admin-return-detail').then((module) => module.AdminReturnDetail),
      },
      {
        path: 'support',
        title: 'Support | Apaar Garage Admin',
        loadComponent: () => import('./support/admin-support').then((module) => module.AdminSupport),
      },
      {
        path: 'support/:ticketNumber',
        title: 'Ticket details | Apaar Garage Admin',
        loadComponent: () => import('./support/admin-ticket-detail').then((module) => module.AdminTicketDetail),
      },
      {
        path: 'customers',
        title: 'Customers | Apaar Garage Admin',
        loadComponent: () => import('./customers/admin-customers').then((module) => module.AdminCustomers),
      },
      {
        path: 'coupons',
        title: 'Coupons | Apaar Garage Admin',
        loadComponent: () => import('./coupons/admin-coupons').then((module) => module.AdminCoupons),
      },
      {
        path: 'blocked-contacts',
        title: 'Blocked contacts | Apaar Garage Admin',
        loadComponent: () => import('./blocked-contacts/admin-blocked-contacts').then((module) => module.AdminBlockedContacts),
      },
      {
        path: 'newsletter',
        title: 'Newsletter | Apaar Garage Admin',
        loadComponent: () => import('./newsletter/admin-newsletter').then((module) => module.AdminNewsletter),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
