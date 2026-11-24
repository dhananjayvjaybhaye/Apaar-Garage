import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { seedProducts } from '../scripts/products.js';
import { rcSamples } from '../scripts/rc-products.js';
import { Product } from '../src/models/product.js';
import { StockMovement } from '../src/models/stock-movement.js';

const run = promisify(execFile);
const seedFile = fileURLToPath(new URL('../scripts/seed.js', import.meta.url));

test('seed upgrades known placeholders and journals opening stock exactly once', async (t) => {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  t.after(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      await database.stop();
    }
  });
  const uri = database.getUri('seed_test');
  await mongoose.connect(uri);
  await Promise.all([Product.init(), StockMovement.init()]);
  const { slug, name, category, brand, images, description, scale } = seedProducts[0];
  const legacy = {
    slug,
    name,
    productType: 'diecast',
    category,
    brand,
    images,
    description,
    scale,
    price: 2500,
    stock: 3,
    placeholder: true,
  };
  await Product.collection.insertMany([
    legacy,
    { ...legacy, slug: 'real-unreviewed-listing', placeholder: false },
  ]);
  const seed = () =>
    run(process.execPath, [seedFile], { env: { ...process.env, MONGODB_URI: uri } });
  assert.match((await seed()).stdout, /Added 26 samples.*Upgraded 1 sample/);
  assert.match((await seed()).stdout, /Added 0 samples.*Upgraded 0 sample/);
  const product = await Product.findOne({ slug }).lean();
  assert.equal(product.status, 'published');
  assert.equal(product.mrp, 2500);
  assert.equal(product.stock, 3);
  assert.equal(await Product.countDocuments({ productType: 'rc', status: 'published' }), 15);
  assert.equal(
    (await Product.findOne({ slug: 'real-unreviewed-listing' }).lean()).status,
    undefined,
  );
  const listingsWithOpeningStock = [...seedProducts, ...rcSamples].filter(
    (sample) => sample.slug !== slug && sample.stock > 0,
  );
  assert.equal(
    await StockMovement.countDocuments({ reason: 'opening' }),
    listingsWithOpeningStock.length,
  );
  assert.equal(await StockMovement.countDocuments({ product: product._id }), 0);
});
