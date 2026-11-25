import { computed, signal } from '@angular/core';
import { issueFor } from './admin-product-feedback';
import type { AdminProductIssue } from './admin-product-types';
import { generalFields, metadataFields, rcFields } from './admin-products.config';

export const fieldId = (key: string) => 'product-' + key.replaceAll('.', '-');

const groupRules = [
  {
    key: 'manufacturerOrImporter',
    label: 'Manufacturer or importer',
    keys: ['manufacturerName', 'manufacturerAddress', 'importerName', 'importerAddress'],
    message: 'Provide a complete manufacturer or importer name and address.',
  },
  {
    key: 'bis',
    label: 'BIS certification',
    keys: ['bisCertified', 'bisLicenceNumber'],
    message: 'For toys graded under 14, select BIS certified and provide the licence number.',
  },
];

export function validationGroup(key: string) {
  return groupRules.find((rule) => rule.key === key);
}

export function groupedIssues(issues: AdminProductIssue[]) {
  const groups = new Map<string, AdminProductIssue>();
  for (const issue of issues) {
    const group = groupRules.find(
      (rule) =>
        issue.field === rule.key ||
        (rule.key === 'bis' &&
          rule.keys.includes(issue.field) &&
          /required for toys|provide the bis/i.test(issue.message)),
    );
    if (group) groups.set(group.key, { field: group.key, message: group.message });
    else groups.set(issue.field, issue);
  }
  return [...groups.values()];
}

export function errorTarget(key: string, draft: Record<string, string>) {
  if (key === 'manufacturerOrImporter') {
    const usingImporter = draft['importerName'] || draft['importerAddress'];
    const usingManufacturer = draft['manufacturerName'] || draft['manufacturerAddress'];
    const prefix = usingImporter && !usingManufacturer ? 'importer' : 'manufacturer';
    return fieldId(prefix + (draft[prefix + 'Name']?.trim() ? 'Address' : 'Name'));
  }
  if (key === 'bis')
    return fieldId(draft['bisCertified'] === 'true' ? 'bisLicenceNumber' : 'bisCertified');
  if (key === 'images' || key.startsWith('images.')) return 'product-images';
  if (key === 'imageAlts' || key.startsWith('imageAlts.'))
    return 'product-image-alt-' + (key.split('.')[1] ?? '0');
  if (key === 'dimensionsMm') return fieldId('dimensionsMm.length');
  const field = [...generalFields, rcFields, metadataFields]
    .flatMap(({ fields }) => fields)
    .find(({ key: candidate }) => candidate === key || key.startsWith(candidate + '.'));
  return field ? fieldId(field.key) : key === 'glbUrl' ? fieldId(key) : undefined;
}

export interface Checklist {
  issues: AdminProductIssue[];
  draftIssues: AdminProductIssue[];
}

export class ProductValidation {
  readonly checked = signal<Checklist>({ issues: [], draftIssues: [] });
  readonly submitted = signal(false);
  readonly publishing = signal(false);
  private readonly touched = signal(new Set<string>());
  private readonly server = signal<AdminProductIssue[]>([]);
  readonly visible = computed(() => {
    const list = this.publishing() ? this.checked().issues : this.checked().draftIssues;
    const show = this.submitted() ? list : list.filter(({ field }) => this.touched().has(field));
    return groupedIssues([...show, ...this.server()]);
  });

  blur(key: string) {
    this.touched.update((keys) => new Set([...keys, key]));
  }

  clear(key: string) {
    this.server.update((issues) => issues.filter((issue) => !issueFor([issue], key)));
  }

  begin(publishing: boolean) {
    this.publishing.set(publishing);
    this.server.set([]);
  }

  fail(issues: AdminProductIssue[]) {
    this.submitted.set(true);
    this.server.set(issues);
  }

  reset() {
    this.checked.set({ issues: [], draftIssues: [] });
    this.submitted.set(false);
    this.touched.set(new Set());
    this.begin(false);
  }
}
