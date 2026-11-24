// Handles credentials and keeps the password hash inside the authentication layer.
import bcrypt from 'bcrypt';
import { bcryptRounds } from '../config/auth.js';
import { User } from '../models/user.js';
import { HttpError } from '../utils/http-error.js';

// Compare a hash even if there is no account to avoid a fast failure for unknown users.
const missingUserHash = await bcrypt.hash('Apaar Garage timing comparison', bcryptRounds);

export async function registerUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  try {
    return await User.create({ name, email, passwordHash, role: 'customer' });
  } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'An account already exists for this email.');
    throw error;
  }
}

export async function authenticate({ email, password }, { admin = false } = {}) {
  const user = await User.findOne({ email })
    .select('+passwordHash +sessionVersion' + (admin ? ' +adminTotp' : ''))
    .lean();
  const valid = await bcrypt.compare(password, user?.passwordHash ?? missingUserHash);
  if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
  return user;
}
