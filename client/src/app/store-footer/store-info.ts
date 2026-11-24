import { httpResource } from '@angular/common/http';
import { computed, Injectable } from '@angular/core';

export interface StoreInfo {
  seller: {
    legalName: string | null;
    tradeName: string;
    address: string | null;
    state: string;
    gstin: string | null;
  };
  gstRegistered: boolean;
  customerCare: { phone: string | null; email: string | null; hours: string | null };
  grievanceOfficer: {
    name: string | null;
    designation: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  defaultReturnWindowDays: number;
  deliveryEstimate: string;
  orderRetentionDays: number;
  complaints: { acknowledgementHours: number; resolutionMonths: number };
  policyDetails: {
    returnConditions: string | null;
    nonReturnableItems: string | null;
    refundTimeline: string | null;
    exchangeTerms: string | null;
    warrantyTerms: string | null;
    otherDataRetention: string | null;
  };
}

export function suppliedText(value?: string | null): string | undefined {
  const text = value?.trim();
  return text &&
    !/^(?:replace with\b|your (?:legal |seller |business )?address\b|to be supplied\b)/i.test(text)
    ? text
    : undefined;
}

@Injectable({ providedIn: 'root' })
export class StoreInformation {
  readonly resource = httpResource<StoreInfo>(() => '/api/store-info');
  readonly data = computed(() => (this.resource.hasValue() ? this.resource.value() : undefined));
}
