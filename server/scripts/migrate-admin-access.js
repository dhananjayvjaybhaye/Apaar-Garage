import mongoose from 'mongoose';
import { createInterface } from 'node:readline/promises';
import { AdminAccessError, noOwnerWarning } from '../src/services/admin-access.js';
import { migrateAdminAccess } from '../src/services/admin-access-migration.js';
import { connectDatabase, DatabaseConnectionError } from '../src/services/database.js';

async function choose(candidates) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new AdminAccessError(
      'Run this command in an interactive terminal to choose the store owner.',
    );
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  const cancellation = new AbortController();
  reader.on('SIGINT', () => cancellation.abort());
  reader.on('close', () => cancellation.abort());
  try {
    for (const [index, { email }] of candidates.entries()) {
      process.stdout.write(index + 1 + '. ' + email + '\n');
    }
    const answer = (
      await reader.question('Choose the store owner by number: ', {
        signal: cancellation.signal,
      })
    ).trim();
    const number = Number(answer);
    if (!/^[1-9]\d*$/.test(answer) || !candidates[number - 1])
      throw new AdminAccessError('No administrator was selected. No access was changed.');
    return candidates[number - 1];
  } catch (error) {
    if (cancellation.signal.aborted)
      throw new AdminAccessError('Migration cancelled. No access was changed.');
    throw error;
  } finally {
    reader.close();
  }
}

try {
  await connectDatabase();
  const result = await migrateAdminAccess(choose);
  if (result.outcome === 'promoted') {
    process.stdout.write(
      'Store owner assigned to ' + result.email + '. Sign in again to use owner access.\n',
    );
  } else if (result.outcome === 'owner-exists') {
    process.stdout.write('A store owner already exists. No access was changed.\n');
  } else {
    process.stdout.write('No administrators exist.\n' + noOwnerWarning + '\n');
  }
} catch (error) {
  process.stderr.write(
    (error instanceof DatabaseConnectionError || error instanceof AdminAccessError
      ? error.message
      : 'Could not migrate administrator access. Check the server database settings.') + '\n',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
