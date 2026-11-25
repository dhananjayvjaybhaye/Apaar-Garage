type FieldType = 'text' | 'textarea' | 'email' | 'tel' | 'integer' | 'money' | 'choice';

interface SettingField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  hint?: string;
}

interface SettingGroup {
  key?: string;
  label: string;
  fields: SettingField[];
}

const email = { type: 'email', maxLength: 254 } as const;
const phone = { type: 'tel', maxLength: 32, hint: 'Indian mobile number' } as const;
const textArea = { type: 'textarea', maxLength: 500 } as const;
const policyText = { type: 'textarea', maxLength: 1000 } as const;
const amount = { type: 'money', pattern: rupeesPattern, maxLength: 17 } as const;

export const settingGroups: SettingGroup[] = [
  {
    key: 'seller',
    label: 'Seller and tax',
    fields: [
      { key: 'legalName', label: 'Legal name' },
      { key: 'tradeName', label: 'Trade name', required: true },
      { key: 'state', label: 'State or union territory', required: true },
      { key: 'gstin', label: 'GSTIN', maxLength: 15, pattern: '[0-9A-Za-z]{15}' },
      { key: 'address', label: 'Business address', ...textArea },
    ],
  },
  {
    key: 'customerCare',
    label: 'Customer care',
    fields: [
      { key: 'phone', label: 'Customer care phone', ...phone },
      { key: 'email', label: 'Customer care email', ...email },
      { key: 'hours', label: 'Customer care hours' },
    ],
  },
  {
    key: 'grievanceOfficer',
    label: 'Grievance officer',
    fields: [
      { key: 'name', label: 'Officer name' },
      { key: 'designation', label: 'Officer designation' },
      { key: 'phone', label: 'Officer phone', ...phone },
      { key: 'email', label: 'Officer email', ...email },
      { key: 'address', label: 'Officer address', ...textArea },
    ],
  },
  {
    label: 'Delivery, payment and invoicing',
    fields: [
      { key: 'codFeePaise', label: 'COD fee', ...amount, required: true },
      { key: 'codMinPaise', label: 'Minimum COD order', ...amount, required: true },
      { key: 'codMaxPaise', label: 'Maximum COD order', ...amount, hint: 'Blank means no maximum.' },
      { key: 'deliveryFeePaise', label: 'Delivery fee', ...amount, required: true },
      { key: 'freeDeliveryThresholdPaise', label: 'Free-delivery threshold', ...amount, hint: 'Blank disables free delivery by order value.' },
      { key: 'deliveryEstimate', label: 'Default delivery estimate', required: true },
      { key: 'invoicePrefix', label: 'Invoice prefix', maxLength: 5, pattern: '[A-Za-z0-9]{1,5}' },
      { key: 'firstOrderDiscountPercent', label: 'First-order discount (%)', type: 'integer', min: 0, max: 100, required: true },
      { key: 'defaultReturnWindowDays', label: 'Return window (days)', type: 'integer', min: 0, max: 365, required: true },
    ],
  },
  {
    key: 'risk',
    label: 'COD risk controls',
    fields: [
      { key: 'openPerPhone', label: 'Open orders per phone', type: 'integer', min: 1 },
      { key: 'openPerAddress', label: 'Open orders per address', type: 'integer', min: 1 },
      { key: 'firstOrderMaxPaise', label: 'First COD order maximum', ...amount },
      { key: 'confirmationAbovePaise', label: 'Require confirmation above', ...amount },
      { key: 'undeliveredThreshold', label: 'Repeated delivery failure threshold', type: 'integer', min: 1 },
      { key: 'undeliveredLookbackDays', label: 'Delivery failure lookback (days)', type: 'integer', min: 1, max: 365, required: true },
      { key: 'repeatedUndeliveredAction', label: 'Repeated delivery failure action', type: 'choice', required: true },
    ],
  },
  {
    key: 'policyDetails',
    label: 'Store policies',
    fields: [
      { key: 'returnConditions', label: 'Return conditions', ...policyText },
      { key: 'nonReturnableItems', label: 'Non-returnable items', ...policyText },
      { key: 'refundTimeline', label: 'Refund timeline', ...policyText },
      { key: 'exchangeTerms', label: 'Exchange terms', ...policyText },
      { key: 'warrantyTerms', label: 'Warranty terms', ...policyText },
      { key: 'otherDataRetention', label: 'Other data retention', ...policyText },
    ],
  },
];

export interface DeliveryRule {
  prefix: string;
  estimate: string;
  cod: boolean;
  serviceable?: boolean;
}

export type SettingsValue = string | number | null;
type FieldValues = Record<string, SettingsValue>;
export type StoreSettings = Record<string, SettingsValue | FieldValues | boolean | DeliveryRule[]> & {
  gstRegistered: boolean;
  serviceablePincodeRules: DeliveryRule[];
};

export function settingsFieldName(group: string | undefined, key: string) {
  return group ? group + '.' + key : key;
}

export function formatSetting(settings: StoreSettings, group: string | undefined, field: SettingField) {
  const value = group ? (settings[group] as FieldValues)?.[field.key] : settings[field.key];
  if (value == null) return '';
  if (field.type !== 'money') return String(value);
  return inputRupees(value as number);
}

function parseSetting(value: string, type?: FieldType) {
  if (!value) return null;
  if (type === 'integer') return Number(value);
  if (type !== 'money') return value;
  return rupeesToPaise(value);
}

export function settingsPayload(form: FormData, rules: DeliveryRule[]): StoreSettings {
  const values: StoreSettings = {
    gstRegistered: form.has('gstRegistered'),
    serviceablePincodeRules: rules.map(({ prefix, estimate, cod, serviceable }) => ({
      prefix: prefix.trim(), estimate: estimate.trim(), cod,
      ...(serviceable === undefined ? {} : { serviceable }),
    })),
  };
  for (const group of settingGroups) {
    const fields = Object.fromEntries(group.fields.map(({ key, type }) => [
      key, parseSetting(String(form.get(settingsFieldName(group.key, key)) ?? '').trim(), type),
    ]));
    if (group.key) values[group.key] = fields;
    else Object.assign(values, fields);
  }
  return values;
}
import { inputRupees, rupeesPattern, rupeesToPaise } from '../admin-money';

