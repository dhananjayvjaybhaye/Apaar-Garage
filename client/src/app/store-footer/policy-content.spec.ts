import { describe, expect, it } from 'vitest';
import { policyContent } from './policy-content';
import type { StoreInfo } from './store-info';

describe('Store policy disclosures', () => {
  it('leaves unknown business terms as placeholders and requests available claim evidence', () => {
    const sections = policyContent('returns', undefined).sections;
    expect(sections.find(({ id }) => id === 'return-window')?.text).toContain(
      'Default return window to be supplied',
    );
    expect(sections.find(({ id }) => id === 'refunds')?.text).toContain(
      'Refund processing timeline to be supplied',
    );
    expect(sections.find(({ id }) => id === 'claims')?.text).toContain(
      'an unboxing video if you have one',
    );
  });

  it('uses the API return window, refund wording, and anonymized-order retention', () => {
    const info = {
      defaultReturnWindowDays: 12,
      orderRetentionDays: 90,
      policyDetails: {
        refundTimeline:
          'Refunds are processed on the schedule shared when your return is approved.',
      },
    } as StoreInfo;
    const sections = policyContent('returns', info).sections;
    expect(sections.find(({ id }) => id === 'return-window')?.text).toContain(
      '12 days from delivery',
    );
    expect(sections.find(({ id }) => id === 'refunds')?.text).toContain(
      info.policyDetails.refundTimeline,
    );
    const privacy = policyContent('privacy', info).sections;
    expect(privacy.find(({ id }) => id === 'retention')?.text).toContain('90 days');
    expect(privacy.find(({ id }) => id === 'browser')?.text).not.toContain('theme');
  });
});
