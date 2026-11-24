import { Product } from '../models/product.js';

const requiredSettings = [
  ['seller', 'legalName', 'Seller legal name'],
  ['seller', 'address', 'Seller business address'],
  ['customerCare', 'phone', 'Customer care phone'],
  ['customerCare', 'email', 'Customer care email'],
  ['grievanceOfficer', 'name', 'Grievance officer name'],
  ['grievanceOfficer', 'email', 'Grievance officer email'],
  ['grievanceOfficer', 'phone', 'Grievance officer phone'],
];

function hasSetting(value) {
  return (
    typeof value === 'string' &&
    Boolean(value.trim()) &&
    !/^(?:replace with\b|to be supplied\b|your (?:legal |seller |business )?address\b)/i.test(
      value.trim(),
    )
  );
}

export async function launchBlockers(settings) {
  const blockers = requiredSettings
    .filter(([group, field]) => !hasSetting(settings[group]?.[field]))
    .map(([, , label]) => label + ' is missing.');
  if (!settings.invoicePrefix) blockers.push('Invoice prefix is unset.');
  const placeholders = await Product.countDocuments({ placeholder: true, status: 'published' });
  if (placeholders) {
    blockers.push('Hide or archive published placeholder products (' + placeholders + ').');
  }
  return blockers;
}

export class LaunchCheckError extends Error {
  constructor(blockers) {
    super(
      'Production launch blocked. Resolve these items and restart:\n' +
        blockers.map((blocker) => '- ' + blocker).join('\n'),
    );
    this.name = 'LaunchCheckError';
  }
}

export async function assertProductionReady(settings) {
  const blockers = await launchBlockers(settings);
  if (blockers.length) throw new LaunchCheckError(blockers);
}
