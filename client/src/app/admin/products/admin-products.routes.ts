import type { CanDeactivateFn, Routes } from '@angular/router';

import type { AdminProductEditor } from './admin-product-editor';

const leaveEditor: CanDeactivateFn<AdminProductEditor> = (editor, _current, _state, next) =>
  editor.navigation.canLeave(next.url);

export const adminProductRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./admin-product-list').then((module) => module.AdminProductList),
  },
  {
    path: 'new',
    data: { permission: 'products.write' },
    canDeactivate: [leaveEditor],
    title: 'Create product | Apaar Garage Admin',
    loadComponent: () =>
      import('./admin-product-editor').then((module) => module.AdminProductEditor),
  },
  {
    path: ':slug/view',
    title: 'View product | Apaar Garage Admin',
    data: { permission: 'products.read' },
    loadComponent: () => import('./admin-product-view').then((module) => module.AdminProductView),
  },
  {
    path: ':slug',
    data: { permission: 'products.write' },
    canDeactivate: [leaveEditor],
    title: 'Edit product | Apaar Garage Admin',
    loadComponent: () =>
      import('./admin-product-editor').then((module) => module.AdminProductEditor),
  },
];
