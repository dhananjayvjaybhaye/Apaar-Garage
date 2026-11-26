import { AdminPromptError } from './admin-prompt.js';

export function adminAccessFlags(flags, { remove = false } = {}) {
  const allowed = remove ? ['--force'] : ['--owner', '--staff', '--force'];
  if (new Set(flags).size !== flags.length || flags.some((flag) => !allowed.includes(flag))) {
    throw new AdminPromptError(
      remove ? 'Use remove-admin with optional --force.' : 'Choose --owner or --staff.',
    );
  }
  const owner = flags.includes('--owner');
  const staff = flags.includes('--staff');
  const force = flags.includes('--force');
  if (owner && staff) throw new AdminPromptError('Choose either --owner or --staff.');
  if (force && !remove && !staff)
    throw new AdminPromptError('--force requires --staff on create-admin.');
  return { access: owner ? 'owner' : staff ? 'staff' : undefined, force };
}
