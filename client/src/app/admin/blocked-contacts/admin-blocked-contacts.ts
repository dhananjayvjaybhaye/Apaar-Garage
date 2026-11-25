import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FieldControl, FormField } from '../../ui/form-field/form-field';
import { adminAction } from '../admin-action';
import { AdminPager, adminList } from '../admin-list';

interface BlockedContact {
  _id: string;
  phone?: string;
  pincode?: string;
  reason: string;
  createdAt: string;
}

const endpoint = '/api/admin/blocked-contacts';

@Component({
  imports: [DatePipe, FieldControl, FormField, AdminPager],
  templateUrl: './admin-blocked-contacts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBlockedContacts {
  protected readonly list = adminList<BlockedContact>(endpoint);
  protected readonly action = adminAction();
  protected readonly removing = signal<BlockedContact | null>(null);

  protected add(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    const values = new FormData(form);
    const phone = String(values.get('phone') ?? '').trim();
    const pincode = String(values.get('pincode') ?? '').trim();
    const reason = String(values.get('reason') ?? '').trim();
    void this.action.run('POST', endpoint, {
      ...(phone && { phone }), ...(pincode && { pincode }), reason,
    }, 'Contact blocked.', () => {
      form.reset();
      this.removing.set(null);
      if (this.list.page() === 1) this.list.resource.reload();
      else this.list.page.set(1);
    });
  }

  protected remove(event: Event, reason: string) {
    event.preventDefault();
    const contact = this.removing();
    if (!contact) return;
    void this.action.run('DELETE', endpoint + '/' + encodeURIComponent(contact._id),
      { reason: reason.trim() }, 'Block removed.', () => {
        this.removing.set(null);
        const page = this.list.page();
        if (page > 1 && this.list.resource.value()?.items.length === 1) this.list.page.set(page - 1);
        else this.list.resource.reload();
      });
  }
}
