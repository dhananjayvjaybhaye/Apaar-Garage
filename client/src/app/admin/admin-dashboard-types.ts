export interface AdminMetrics {
  ownerWarning?: string | null;
  counts: {
    ordersToConfirm: number;
    codToCollect: number;
    riskOrders: number;
    undelivered: number;
    openReturns: number;
    ticketsDueSoon: number;
    lowStock: number;
    soldOut: number;
  };
  sales: { date: string; totalPaise: number }[];
  topSellers: { slug: string; name: string; quantity: number }[];
}

export interface AuditEntry {
  _id: string;
  actorLabel: string;
  action: string;
  targetLabel?: string;
  ip?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  at: string;
}

const actionLabels: Record<string, string> = {
  'admin.2fa_enrolled': 'Two-factor enabled',
  'admin.sign_in': 'Admin signed in',
  'admin.sign_in_failed': 'Sign-in failed',
  'admin.sign_in_locked': 'Sign-in locked',
  'admin.sign_in_setup_required': 'Authenticator setup required',
  'admin.role_granted': 'Admin role granted',
  'admin.role_removed': 'Admin role removed',
  'admin.access_changed': 'Admin access changed',
  'admin.access_migrated': 'Store owner assigned',
  'admin.created': 'Admin account created',
  'admin.password_rotated': 'Admin password changed',
  'settings.updated': 'Store settings updated',
  'privacy.contact_viewed': 'Contact details viewed',
  'product.created': 'Product created',
  'product.updated': 'Product updated',
  'product.stock_adjusted': 'Stock adjusted',
  'product.status_changed': 'Product status changed',
  'product.duplicated': 'Product duplicated',
  'order.status_changed': 'Order status changed',
  'order.payment_collected': 'COD recorded as collected',
  'order.refund_recorded': 'Refund recorded',
  'order.return_changed': 'Return updated',
  'order.return_requested': 'Return requested',
  'order.placed': 'Order placed',
  'order.cancelled': 'Order cancelled',
  'order.note_added': 'Order note added',
  'order.confirmation_changed': 'Customer confirmation updated',
};

export function auditActionLabel(action: string) {
  if (actionLabels[action]) return actionLabels[action];
  const readable = action.replace(/[._]/g, ' ');
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}
