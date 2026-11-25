export const adminAuthApi = '/api/auth/admin';
export const adminDashboardPath = '/admin';
export const adminLoginPath = '/admin/login';
export function adminProductEditorReturn(path: string | null): string | undefined {
  return path && /^\/admin\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
    ? path
    : undefined;
}

export const adminCsrfHeader = 'X-Admin-CSRF';
export const warningMs = 2 * 60_000;
export const activityThrottleMs = 60_000;
export const sessionClockMs = 1_000;
export const paisePerRupee = 100;

export const adminNavigation = [
  { path: '/admin', label: 'Dashboard', permission: 'dashboard.read' },
  { path: '/admin/products', label: 'Products', permission: 'products.read' },
  { path: '/admin/orders', label: 'Orders', permission: 'orders.work' },
  { path: '/admin/returns', label: 'Returns', permission: 'returns.work' },
  { path: '/admin/support', label: 'Support', permission: 'support.work' },
  { path: '/admin/customers', label: 'Customers', permission: 'customers.read' },
  { path: '/admin/coupons', label: 'Coupons', permission: 'coupons.manage' },
  { path: '/admin/blocked-contacts', label: 'Blocked contacts', permission: 'blocked-contacts.manage' },
  { path: '/admin/newsletter', label: 'Newsletter', permission: 'newsletter.read' },
  { path: '/admin/settings', label: 'Settings', permission: 'settings.read' },
  { path: '/admin/users', label: 'Admin users', permission: 'admin-users.manage' },
];
export const dashboardCards = [
  { key: 'ordersToConfirm', label: 'Orders to confirm' },
  { key: 'codToCollect', label: 'COD to collect' },
  { key: 'riskOrders', label: 'Orders needing customer confirmation' },
  { key: 'undelivered', label: 'Undelivered parcels' },
  { key: 'openReturns', label: 'Open returns' },
  { key: 'ticketsDueSoon', label: 'Tickets due soon or overdue' },
  { key: 'lowStock', label: 'Low-stock products' },
  { key: 'soldOut', label: 'Sold-out products' },
] as const;
