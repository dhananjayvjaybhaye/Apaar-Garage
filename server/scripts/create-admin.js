import mongoose from 'mongoose';
import { AdminPromptError, promptForAdmin } from './admin-prompt.js';
import { createOrPromoteAdministrator } from '../src/services/admin-bootstrap.js';
import { connectDatabase, DatabaseConnectionError } from '../src/services/database.js';
import { User } from '../src/models/user.js';

try {
  const flags = process.argv.slice(2);
  if (flags.length > 1 || (flags[0] && !['--owner', '--staff'].includes(flags[0])))
    throw new AdminPromptError('Use --owner or --staff to choose administrator access.');
  const { email, password } = await promptForAdmin();
  await connectDatabase();
  await User.init();
  await createOrPromoteAdministrator(email, password, flags[0]?.slice(2));
  process.stdout.write('Administrator access saved. Sign in with the password you just set.\n');
} catch (error) {
  const message =
    error instanceof AdminPromptError || error instanceof DatabaseConnectionError
      ? error.message
      : 'Could not save administrator access. Check the server database settings and try again.';
  process.stderr.write(message + '\n');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
