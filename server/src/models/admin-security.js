import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;
const sessionSchema = new mongoose.Schema({
  _id: String,
  user: { type: ObjectId, required: true, index: true },
  sessionVersion: { type: Number, required: true },
  scope: { type: String, enum: ['admin', 'setup'], required: true },
  csrf: { type: String, required: true },
  mfaVerified: { type: Boolean, default: false },
  pendingTotp: String,
  issuedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  idleUntil: { type: Date, required: true },
});
export const AdminSession = mongoose.model('AdminSession', sessionSchema);

export const AdminAccessLock = mongoose.model(
  'AdminAccessLock',
  new mongoose.Schema({ _id: String, revision: Number }),
);

export const AdminLoginLimit = mongoose.model(
  'AdminLoginLimit',
  new mongoose.Schema({
    _id: String,
    attempts: [{ _id: false, id: String, at: Date, failed: Boolean }],
    expiresAt: { type: Date, expires: 0 },
    locked: Boolean,
  }),
);

const auditSchema = new mongoose.Schema({
  who: { type: ObjectId, ref: 'User' },
  action: { type: String, required: true },
  target: String,
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  ip: String,
  at: { type: Date, required: true, default: Date.now },
});
auditSchema.index({ at: -1, _id: -1 });
export const AuditLog = mongoose.model('AuditLog', auditSchema);
