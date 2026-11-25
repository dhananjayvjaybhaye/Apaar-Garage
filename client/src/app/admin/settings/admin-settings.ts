import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { apiMessage } from '../../api-message';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { AdminSessionStore } from '../admin-session-store';
import { AdminDeliveryRules, type DeliveryRuleRow } from './admin-delivery-rules';
import {
  formatSetting, settingGroups, settingsFieldName, settingsPayload, type StoreSettings,
} from './admin-settings-fields';

const settingsApi = '/api/admin/settings';

@Component({
  imports: [FieldControl, FormField, AdminDeliveryRules],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettings {
  private readonly sessions = inject(AdminSessionStore);
  protected readonly canEdit = computed(() => this.sessions.session()?.canEditSettings === true);
  protected readonly settings = signal<StoreSettings | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly readiness = signal<string[] | null>(null);
  protected readonly readinessError = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly saved = signal(false);
  protected readonly issues = signal<Record<string, string>>({});
  protected readonly rules = signal<DeliveryRuleRow[]>([]);
  protected readonly registered = signal(false);
  protected readonly groups = settingGroups;
  protected readonly fieldName = settingsFieldName;
  protected readonly display = formatSetting;

  constructor() {
    void this.load();
    void this.loadReadiness();
  }

  protected async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.show(await this.sessions.request<StoreSettings>('GET', settingsApi));
    } catch (error) {
      this.loadError.set(apiMessage(error, 'Could not load store settings.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadReadiness() {
    this.readiness.set(null);
    this.readinessError.set('');
    try {
      const { blockers } = await this.sessions.request<{ blockers: string[] }>('GET', settingsApi + '/readiness');
      this.readiness.set(blockers);
    } catch (error) {
      this.readinessError.set(apiMessage(error, 'Could not check launch readiness.'));
    }
  }

  protected async save(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    if (!this.canEdit() || this.saving()) return;
    const payload = settingsPayload(new FormData(form), this.rules());
    this.saving.set(true);
    this.saved.set(false);
    this.issues.set({});
    this.saveError.set('');
    try {
      this.show(await this.sessions.request<StoreSettings>('PUT', settingsApi, payload));
      this.saved.set(true);
      await this.loadReadiness();
    } catch (error) {
      this.saveError.set(apiMessage(error, 'Could not save store settings.'));
      if (error instanceof HttpErrorResponse && error.error?.code === 'INVALID_SETTINGS') {
        const issues = error.error.details.issues as { field: string; message: string }[];
        this.issues.set(Object.fromEntries(issues.map(({ field, message }) => [field, message])));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private show(settings: StoreSettings) {
    this.settings.set(settings);
    this.registered.set(settings.gstRegistered);
    this.rules.set(settings.serviceablePincodeRules.map((rule, index) => ({ ...rule, id: index + 1 })));
  }
}
