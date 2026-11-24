import mongoose from 'mongoose';
import { AdminPromptError, promptForAdmin } from './admin-prompt.js';
import { createOrPromoteAdministrator } from '../src/services/admin-bootstrap.js';
import { connectDatabase, DatabaseConnectionError } from '../src/services/database.js';
import { User } from '../src/models/user.js';

try {
  const { email, password } = await promptForAdmin();
  await connectDatabase();
  await User.init();
  await createOrPromoteAdministrator(email, password);
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
