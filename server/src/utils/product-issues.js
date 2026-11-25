import { publicationIssues } from './product-compliance.js';

export function productIssues(candidate, validationIssues) {
  const issues = new Map(publicationIssues(candidate ?? {}).map((issue) => [issue.field, issue]));
  for (const { path, message, code } of validationIssues) {
    const field = path.join('.');
    if (issues.has(field)) continue;
    let value = candidate;
    for (const part of path) value = value?.[part];
    const missing = field && value == null && code === 'invalid_type';
    issues.set(field, { field, message: missing ? 'This field is required.' : message });
  }
  return [...issues.values()];
}
