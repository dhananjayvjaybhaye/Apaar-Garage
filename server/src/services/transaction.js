import mongoose from 'mongoose';
import { HttpError } from '../utils/http-error.js';

export async function transaction(action) {
  try {
    return await mongoose.connection.transaction(action, { readPreference: 'primary' });
  } catch (error) {
    if (error.code === 20 && /transaction/i.test(error.message)) {
      throw new HttpError(503, 'This operation requires a MongoDB replica set or sharded cluster.');
    }
    throw error;
  }
}
