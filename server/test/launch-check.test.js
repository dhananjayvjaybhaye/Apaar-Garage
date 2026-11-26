import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { seedProducts } from '../scripts/products.js';
import { Product } from '../src/models/product.js';
import { assertProductionReady, LaunchCheckError } from '../src/services/launch-check.js';
import { User } from '../src/models/user.js';
import { noOwnerWarning } from '../src/services/admin-access.js';

const exec = promisify(execFile);
const main = fileURLToPath(new URL('../src/index.js', import.meta.url));
const migrate = fileURLToPath(new URL('../scripts/migrate-admin-access.js', import.meta.url));

test('production refuses to listen when launch requirements are incomplete', async (t) => {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  t.after(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      await database.stop();
    }
  });
  const uri = database.getUri('launch_check');
  await mongoose.connect(uri);
  await Product.init();
  await Product.create(seedProducts[0]);

  const expected = {
    seller: { legalName: 'Test Seller LLC', address: 'Test business address' },
    customerCare: { phone: '9876543210', email: 'care@example.test' },
    grievanceOfficer: { name: 'Test Officer', phone: '8765432109', email: 'officer@example.test' },
    invoicePrefix: 'AG',
  };
  await assert.rejects(assertProductionReady(expected), {
    name: LaunchCheckError.name,
    message: /published placeholder products \(1\)/,
  });

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    MONGODB_URI: uri,
    JWT_SECRET: 'dummy-signing-secret-for-a-disposable-replica-set',
    ORDER_EMAIL_ENABLED: 'false',
    GST_REGISTERED: 'false',
    SELLER_NAME: '',
    SELLER_ADDRESS: 'Replace with seller address',
    CUSTOMER_CARE_PHONE: '',
    CUSTOMER_CARE_EMAIL: '',
    GRIEVANCE_NAME: '',
    GRIEVANCE_PHONE: '',
    GRIEVANCE_EMAIL: '',
    INVOICE_PREFIX: '',
  };
  await assert.rejects(exec(process.execPath, [main], { env, timeout: 25_000 }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Production launch blocked/);
    assert.ok(error.stderr.includes(noOwnerWarning));
    for (const missing of [
      'Seller legal name',
      'Seller business address',
      'Customer care phone',
      'Customer care email',
      'Grievance officer name',
      'Grievance officer email',
      'Grievance officer phone',
      'Invoice prefix is unset',
      'The store must have an owner',
      'published placeholder products (1)',
    ])
      assert.ok(error.stderr.includes(missing), missing);
    assert.ok(!error.stderr.includes(uri));
    assert.doesNotMatch(error.stdout, /API listening/);
    return true;
  });

  await Product.updateOne({ slug: seedProducts[0].slug }, { $set: { status: 'hidden' } });
  await assert.rejects(assertProductionReady(expected), /must have an owner/);
  const legacy = await User.create({
    name: 'Original administrator',
    email: 'legacy@example.test',
    role: 'admin',
    passwordHash: 'fixture',
  });
  const { stdout } = await exec(process.execPath, [migrate], { env, timeout: 25_000 });
  assert.match(stdout, /Store owner assigned to legacy@example.test/);
  assert.equal((await User.findById(legacy._id)).adminAccess, 'owner');
  const repeated = await exec(process.execPath, [migrate], { env, timeout: 25_000 });
  assert.match(repeated.stdout, /already exists.*No access was changed/);
  await assert.doesNotReject(assertProductionReady(expected));
});
