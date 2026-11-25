import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { seedProducts } from '../scripts/products.js';
import { imageMaxBytes } from '../src/config/admin-panel.js';
import { Order } from '../src/models/order.js';
import { Product } from '../src/models/product.js';
import { StockMovement } from '../src/models/stock-movement.js';
import { makeAdmin, shopper, startStore } from './store-fixture.js';

const products = '/admin/products';
const write = (method, body, status = 200) => ({ method, body, status });
const imageMime = 'image/png';

test('admin dashboard, product management, and authenticated media uploads', async (t) => {
  const localDirectory = await mkdtemp(join(tmpdir(), 'apaar-test-uploads-'));
  t.after(() => rm(localDirectory, { recursive: true, force: true }));
  const origin = await startStore(t, {}, { productMedia: { localDirectory, cloud: null } });
  const admin = await makeAdmin(origin);

  await t.test('dashboard counts workflows and resolves the admin audit actor', async () => {
    const first = seedProducts[0];
    await Product.updateOne({ slug: first.slug }, { $set: { stock: 1, lowStockThreshold: 2 } });
    await Order.collection.insertMany([
      {
        number: 'test-placed',
        status: 'placed',
        needsConfirmation: true,
        customerConfirmation: { status: 'pending' },
      },
      {
        number: 'test-pending',
        status: 'delivered',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
      },
      { number: 'test-undelivered', status: 'undelivered' },
      {
        number: 'test-collected',
        status: 'delivered',
        paymentMethod: 'cod',
        paymentStatus: 'collected',
        createdAt: new Date(),
        totalPaise: 20000,
        items: [{ slug: first.slug, name: first.name, quantity: 2 }],
      },
    ]);
    const { value } = await admin('/admin/overview/dashboard');
    assert.equal(value.counts.ordersToConfirm, 1);
    assert.equal(value.counts.codToCollect, 1);
    assert.equal(value.counts.riskOrders, 1);
    assert.equal(value.counts.undelivered, 1);
    assert.ok(value.counts.lowStock >= 1);
    assert.equal(value.sales.length, 30);
    assert.equal(
      value.sales.reduce((sum, item) => sum + item.totalPaise, 0),
      20000,
    );
    assert.deepEqual(value.topSellers[0], { name: first.name, slug: first.slug, quantity: 2 });
    const audit = (await admin('/admin/overview/audit')).value.items.find(
      ({ action }) => action === 'admin.sign_in',
    );
    assert.equal(audit.actorLabel, 'Store Administrator');
    assert.equal(audit.targetLabel, 'Store Administrator');
  });

  await t.test(
    'filters and bulk status reuse publication validation; copies and stock stay safe',
    async () => {
      const { _id: _ignored, ...source } = seedProducts[0];
      const valid = {
        ...source,
        slug: 'panel-ready',
        sku: 'PANEL-READY',
        productType: 'diecast',
        name: 'Ready panel draft',
        stock: 1,
        status: 'draft',
        placeholder: false,
        imageAlts: ['Front view'],
        costPrice: 200,
        tags: ['gift', 'display'],
        seoTitle: 'Display model',
        seoDescription: 'A collectible display model.',
      };
      const incomplete = {
        ...valid,
        slug: 'panel-incomplete',
        sku: 'PANEL-UNREADY',
        name: 'Incomplete panel draft',
        mrp: undefined,
      };
      const rejectedCreate = await admin(products, {
        ...write('POST', valid, 403),
        headers: { 'X-Admin-CSRF': 'stale-token' },
        sendCsrf: false,
      });
      assert.equal(rejectedCreate.value.code, 'ADMIN_CSRF_MISMATCH');
      assert.equal(await Product.countDocuments({ slug: valid.slug }), 0);
      await admin(products, write('POST', valid, 201));
      await admin(products, write('POST', incomplete, 201));
      const list = await admin(
        products +
          '?q=panel&status=draft&productType=diecast&compliance=incomplete&stock=low&sort=name',
      );
      assert.deepEqual(
        list.value.items.map(({ slug }) => slug),
        [incomplete.slug],
      );
      assert.equal(list.value.items[0].issues[0].field, 'mrp');
      const check = await admin(products + '/checklist', write('POST', incomplete));
      assert.ok(check.value.issues.some(({ field }) => field === 'mrp'));
      const rejected = await admin(
        products + '/bulk-status',
        write('PATCH', { slugs: [valid.slug, incomplete.slug], status: 'published' }, 400),
      );
      assert.ok(
        rejected.value.details.some(
          ({ slug, field }) => slug === incomplete.slug && field === 'mrp',
        ),
      );
      assert.equal((await admin(products + '/' + valid.slug)).value.status, 'draft');
      await admin(
        products + '/bulk-status',
        write('PATCH', { slugs: [valid.slug], status: 'published' }),
      );
      const visitor = shopper(origin);
      const detail = await visitor('/products/' + valid.slug);
      assert.equal(detail.value.costPrice, undefined);
      assert.deepEqual(detail.value.imageAlts, ['Front view']);
      assert.deepEqual(detail.value.tags, ['gift', 'display']);
      assert.equal(detail.value.seoTitle, 'Display model');
      assert.equal(detail.value.seoDescription, 'A collectible display model.');
      const copy = await admin(products + '/' + valid.slug + '/duplicate', write('POST', {}, 201));
      assert.notEqual(copy.value.slug, valid.slug);
      assert.equal(copy.value.stock, 0);
      assert.equal(copy.value.status, 'draft');
      assert.equal(copy.value.sku, undefined);
      assert.deepEqual(copy.value.imageAlts, ['Front view']);
      await admin(
        products + '/' + valid.slug + '/stock',
        write('PATCH', { delta: 2, reason: 'Delivery received' }),
      );
      const product = await Product.findOne({ slug: valid.slug }).lean();
      const movement = await StockMovement.findOne({
        product: product._id,
        reason: 'adjustment',
      }).lean();
      assert.equal(product.stock, 3);
      assert.equal(movement.adjustmentReason, 'Delivery received');
      assert.equal(movement.delta, 2);
      await admin(
        products + '/bulk-status',
        write('PATCH', { slugs: [valid.slug], status: 'hidden' }),
      );
      await visitor('/products/' + valid.slug, { status: 404 });
    },
  );

  await t.test(
    'the publication checklist and create enforce the same BIS and importer rules',
    async () => {
      const incomplete = {
        ...seedProducts[0],
        slug: 'panel-bis-check',
      productType: 'diecast',
        sku: 'PANEL-BIS-CHECK',
        status: 'published',
        placeholder: false,
        ageGradeMin: 10,
        manufacturerName: undefined,
        manufacturerAddress: undefined,
        importerName: 'Example Importer',
        importerAddress: undefined,
        bisCertified: false,
        bisLicenceNumber: undefined,
      };
      const check = await admin(products + '/checklist', write('POST', incomplete));
      const rejected = await admin(products, write('POST', incomplete, 400));
      assert.deepEqual(check.value.issues, rejected.value.details);
      for (const key of ['manufacturerOrImporter', 'bisCertified', 'bisLicenceNumber'])
        assert.ok(check.value.issues.some(({ field }) => field === key));
      const complete = {
        ...incomplete,
        importerAddress: '1 Example Road',
        bisCertified: true,
        bisLicenceNumber: 'EXAMPLE-LICENCE',
      };
      const ready = await admin(products + '/checklist', write('POST', complete));
      assert.deepEqual(ready.value.issues, []);
    },
  );

  await t.test(
    'uploads require CSRF and validate image content, limits and GLB structure',
    async () => {
      const raw = (bytes, type, status = 201, sendCsrf = true) => ({
        method: 'POST',
        raw: bytes,
        headers: { 'Content-Type': type },
        status,
        sendCsrf,
      });
      const png = await sharp({
        create: { width: 1800, height: 300, channels: 3, background: '#d39b5b' },
      })
        .png()
        .toBuffer();
      await admin('/admin/media/image', raw(png, imageMime, 403, false));
      await admin('/admin/media/image', raw(Buffer.from('not a png'), imageMime, 400));
      await admin('/admin/media/image', raw(Buffer.alloc(imageMaxBytes + 1), imageMime, 413));
      const { value } = await admin('/admin/media/image', raw(png, imageMime));
      const response = await fetch(origin + value.url.replace('/api', ''));
      assert.equal(response.status, 200);
      const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      assert.equal(meta.format, 'webp');
      assert.equal(meta.width, 1600);
      await admin('/admin/media/model', raw(Buffer.from('bad'), 'model/gltf-binary', 400));
      const model = await readFile(
        new URL(
          '../../client/public/images/models/Sports%20Car%20by%20Quaternius%20-%20Gzj704DXdr.glb',
          import.meta.url,
        ),
      );
      const modelUpload = await admin('/admin/media/model', raw(model, 'model/gltf-binary'));
      assert.match(modelUpload.value.url, /\.glb$/);
      assert.equal(modelUpload.value.bytes, model.length);
    },
  );
});
