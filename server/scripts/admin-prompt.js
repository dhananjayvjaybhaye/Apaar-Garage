import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { accountEmail, administratorPassword } from '../src/utils/auth-input.js';

export class AdminPromptError extends Error {}

function parsed(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new AdminPromptError(result.error.issues[0].message);
  return result.data;
}

export async function promptForAdmin(
  input = process.stdin,
  output = process.stdout,
  { remove = false } = {},
) {
  if (!input.isTTY || !output.isTTY) {
    throw new AdminPromptError(
      'Run this command in an interactive terminal to enter the password securely.',
    );
  }

  let masked = false;
  const terminal = new Writable({
    write(chunk, _encoding, done) {
      if (masked) done();
      else output.write(chunk, done);
    },
  });
  Object.defineProperty(terminal, 'columns', { get: () => output.columns });
  const reader = createInterface({ input, output: terminal, terminal: true, historySize: 0 });
  const cancellation = new AbortController();
  reader.on('SIGINT', () => cancellation.abort());
  reader.on('close', () => cancellation.abort());
  const signal = cancellation.signal;
  const prompt = (message) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const cancelled = () => reject(signal.reason);
      signal.addEventListener('abort', cancelled, { once: true });
      reader.question(message, { signal }, (answer) => {
        // Switch before readline processes any additional characters in this input chunk.
        masked = true;
        signal.removeEventListener('abort', cancelled);
        resolve(answer);
      });
    });
  const secret = async (message) => {
    output.write(message);
    try {
      return await prompt('');
    } finally {
      output.write('\n');
    }
  };

  try {
    const email = parsed(accountEmail, await prompt('Admin email: '));
    if (remove) {
      const confirmation = await secret('Type REMOVE to confirm (input hidden): ');
      if (confirmation !== 'REMOVE') throw new AdminPromptError('Admin removal cancelled.');
      return { email };
    }
    const password = parsed(administratorPassword, await secret('Password (hidden): '));
    if (password !== (await secret('Confirm password (hidden): '))) {
      throw new AdminPromptError('The passwords did not match.');
    }
    return { email, password };
  } catch (error) {
    if (cancellation.signal.aborted) throw new AdminPromptError('Admin setup cancelled.');
    throw error;
  } finally {
    reader.close();
    terminal.end();
  }
}
