export const adminPermission = Object.freeze({
  dashboard: 'dashboard.read',
  audit: 'audit.read',
  orders: 'orders.work',
  orderExport: 'orders.export',
  returns: 'returns.work',
  support: 'support.work',
  customers: 'customers.read',
  customerExport: 'customers.export',
  productRead: 'products.read',
  productWrite: 'products.write',
  productCost: 'products.cost',
  productImport: 'products.import',
  settingsRead: 'settings.read',
  settingsWrite: 'settings.write',
  coupons: 'coupons.manage',
  blockedContacts: 'blocked-contacts.manage',
  newsletterRead: 'newsletter.read',
  newsletterExport: 'newsletter.export',
  newsletterManage: 'newsletter.manage',
  fullContactLists: 'contacts.list-full',
  adminUsers: 'admin-users.manage',
});

const p = adminPermission;
const staff = Object.freeze([
  p.dashboard, p.orders, p.returns, p.support, p.productRead, p.settingsRead, p.newsletterRead,
]);
const owner = Object.freeze(Object.values(p));

export function adminPermissions(access) {
  return access === 'owner' ? owner : staff;
}

export function hasAdminPermission(user, permission) {
  return user?.role === 'admin' && adminPermissions(user.adminAccess).includes(permission);
}
