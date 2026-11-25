export const rupeesPattern = '[0-9]+([.][0-9]{1,2})?';

export function rupeesToPaise(value: string): number {
  const [whole, fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function inputRupees(paise?: number | null): string {
  if (paise == null) return '';
  const amount = BigInt(paise);
  return String(amount / 100n) + '.' + String(amount % 100n).padStart(2, '0');
}
