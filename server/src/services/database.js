import mongoose from 'mongoose';
import { readDatabaseUri } from '../utils/config.js';

const serverSelectionTimeoutMs = 5000;

export async function connectDatabase() {
  await mongoose.connect(readDatabaseUri(), { serverSelectionTimeoutMS: serverSelectionTimeoutMs });
}
