import mongoose from 'mongoose';
import { readDatabaseUri } from '../utils/config.js';

const serverSelectionTimeoutMs = 5000;

export class DatabaseConnectionError extends Error {
  constructor() {
    super(
      'Could not connect to MongoDB. Check that your IP is allowed in Atlas Network Access, ' +
        'the password in MONGODB_URI is correct, the cluster is not paused, and your VPN or network allows the connection.',
    );
  }
}

export async function connectDatabase() {
  try {
    await mongoose.connect(readDatabaseUri(), {
      serverSelectionTimeoutMS: serverSelectionTimeoutMs,
    });
  } catch {
    throw new DatabaseConnectionError();
  }
}
