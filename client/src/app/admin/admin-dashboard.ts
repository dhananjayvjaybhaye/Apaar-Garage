import { CurrencyPipe, DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../api-message';
import { AdminSessionStore } from './admin-session-store';
import { AdminTotpSetup } from './admin-totp-setup';
import { type AdminMetrics, type AuditEntry, auditActionLabel } from './admin-dashboard-types';
import { dashboardCards, paisePerRupee } from './admin.config';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CurrencyPipe, DatePipe, JsonPipe, RouterLink, AdminTotpSetup],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  protected readonly sessions = inject(AdminSessionStore);
  protected readonly cards = dashboardCards;
  protected readonly paise = paisePerRupee;
  protected readonly label = auditActionLabel;
  protected readonly loading = signal(true);
  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly metrics = signal<AdminMetrics | null>(null);
  protected readonly error = signal('');
  protected readonly setup = signal(false);
  protected readonly canReadAudit = computed(() => this.sessions.can('audit.read'));
  protected readonly maxSales = computed(() =>
    Math.max(1, ...(this.metrics()?.sales ?? []).map(({ totalPaise }) => totalPaise)),
  );

  constructor() {
    void this.refresh();
  }

  protected async refresh() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [metrics, audit] = await Promise.all([
        this.sessions.request<AdminMetrics>('GET', '/api/admin/overview/dashboard'),
        this.canReadAudit()
          ? this.sessions.request<{ items: AuditEntry[] }>('GET', '/api/admin/overview/audit')
          : Promise.resolve({ items: [] }),
      ]);
      this.metrics.set(metrics);
      this.entries.set(audit.items);
    } catch (error) {
      this.error.set(apiMessage(error, 'The dashboard could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }
}
