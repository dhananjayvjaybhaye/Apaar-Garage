import mongoose from 'mongoose';
import { AdminPromptError, promptForAdmin } from './admin-prompt.js';
import { createOrPromoteAdministrator } from '../src/services/admin-bootstrap.js';
import { connectDatabase, DatabaseConnectionError } from '../src/services/database.js';
import { User } from '../src/models/user.js';
import { AdminAccessError, hasStoreOwner } from '../src/services/admin-access.js';
import { adminAccessFlags } from './admin-access-flags.js';

try {
  const { access, force } = adminAccessFlags(process.argv.slice(2));
  await connectDatabase();
  await User.init();
  if (access === undefined && (await hasStoreOwner()))
    throw new AdminAccessError(
      'A store owner already exists. Choose --owner or --staff explicitly.',
    );
  const { email, password } = await promptForAdmin();
  await createOrPromoteAdministrator(email, password, access, { force });
  process.stdout.write('Administrator access saved. Sign in with the password you just set.\n');
} catch (error) {
  const message =
    error instanceof AdminPromptError ||
    error instanceof DatabaseConnectionError ||
    error instanceof AdminAccessError
      ? error.message
      : 'Could not save administrator access. Check the server database settings and try again.';
  process.stderr.write(message + '\n');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
