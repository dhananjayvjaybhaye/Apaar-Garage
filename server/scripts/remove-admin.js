import mongoose from 'mongoose';
import { AdminPromptError, promptForAdmin } from './admin-prompt.js';
import { removeAdministrator } from '../src/services/admin-bootstrap.js';
import { connectDatabase, DatabaseConnectionError } from '../src/services/database.js';
import { AdminAccessError } from '../src/services/admin-access.js';
import { adminAccessFlags } from './admin-access-flags.js';

try {
  const { force } = adminAccessFlags(process.argv.slice(2), { remove: true });
  const { email } = await promptForAdmin(process.stdin, process.stdout, { remove: true });
  await connectDatabase();
  const removed = await removeAdministrator(email, { force });
  process.stdout.write(
    removed
      ? 'Administrator access removed.\n'
      : 'No administrator role was found for that account.\n',
  );
} catch (error) {
  process.stderr.write(
    (error instanceof AdminPromptError ||
    error instanceof DatabaseConnectionError ||
    error instanceof AdminAccessError
      ? error.message
      : 'Could not remove administrator access. Check the server database settings.') + '\n',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
