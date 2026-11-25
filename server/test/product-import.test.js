import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { sheetMaxBytes } from '../src/config/product-import.js';
import { Product } from '../src/models/product.js';
import { StockMovement } from '../src/models/stock-movement.js';
import { parseProductSheet } from '../src/utils/product-sheet.js';
import { example, sheetFor, zipFiles } from './product-import-fixtures.js';
import { makeAdmin, shopper, startStore } from './store-fixture.js';

const base = '/admin/product-imports';
function form(name, content, options = {}) {
  const upload = new FormData();
  upload.set('sheet', new Blob([content]), name);
  if (options.mode) upload.set('mode', options.mode);
  if (options.proof) upload.set('proof', options.proof);
  if (options.zip) upload.set('images', new Blob([options.zip]), 'images.zip');
  return upload;
}

test('admin previews and confirms drafts, restores import idempotency, and audits results', async (t) => {
  const localDirectory = await mkdtemp(join(tmpdir(), 'apaar-import-test-'));
  t.after(() => rm(localDirectory, { force: true, recursive: true }));
  const origin = await startStore(t, {}, { productMedia: { cloud: null, localDirectory } });
  const admin = await makeAdmin(origin);
  const post = (path, raw, status = 200) =>
    admin(base + path, { method: 'POST', raw, status }).then(({ value }) => value);

  await t.test('preview does not persist; invalid rows carry exact field errors', async () => {
    const bad = {
      ...example,
      sku: 'BAD-1',
      slug: 'invalid-import-row',
      name: '=literal name',
      scale: '2:32',
    };
    const payload = await sheetFor([example, bad]);
    const send = (path, proof, status) =>
      post(path, form('mixed.csv', payload, { mode: 'create', proof }), status);
    const preview = await send('/preview');
    assert.deepEqual(preview.counts, { create: 1, update: 0, unchanged: 0, error: 1 });
    assert.deepEqual(preview.rows[1].errors, [
      { field: 'scale', message: 'Enter a scale like 1:64.' },
    ]);
    assert.match(preview.failedCsv, /"'=literal name"/);
    assert.equal(await Product.countDocuments({ sku: example.sku }), 0);

    const tampered = await sheetFor([{ ...example, stock: 20 }]);
    await post(
      '/apply',
      form('mixed.csv', tampered, { mode: 'create', proof: preview.proof }),
      409,
    );
    await send('/apply', undefined, 409);
    const confirmations = await Promise.all([
      send('/apply', preview.proof),
      send('/apply', preview.proof),
    ]);
    assert.equal(confirmations[0].counts.create + confirmations[1].counts.create, 1);
    const saved = await Product.findOne({ sku: example.sku }).lean();
    assert.equal(saved.status, 'draft');
    assert.equal(saved.stock, 4);
    assert.equal(saved.description, example.description);
    assert.equal(await Product.countDocuments({ sku: bad.sku }), 0);
    const stocks = await StockMovement.find({ product: saved._id }).lean();
    assert.deepEqual(
      stocks.map(({ reason, delta }) => [reason, delta]),
      [['import', 4]],
    );
    const publish = await admin('/admin/products/' + example.slug, {
      method: 'PATCH',
      body: { status: 'published' },
      status: 400,
    });
    assert.ok(publish.value.details.some(({ field }) => field === 'mrp'));

    const replay = await send('/preview');
    assert.equal(replay.counts.unchanged, 1);
    const history = (await admin(base + '/history')).value;
    assert.ok(
      history.some(
        ({ file, mode, counts, actor }) =>
          file === 'mixed.csv' &&
          mode === 'create' &&
          counts.create === 1 &&
          actor === 'admin@example.test',
      ),
    );
  });

  await t.test(
    'update by SKU journals the stock delta and blocks changes after preview',
    async () => {
      const submit = async (stock) => {
        const content = await sheetFor([{ sku: example.sku, stock }], 'xlsx');
        const data = (proof) => form('update.xlsx', content, { mode: 'upsert', proof });
        const preview = await post('/preview', data());
        assert.equal(preview.rows[0].status, 'update');
        return () => post('/apply', data(preview.proof));
      };
      const apply = await submit(7);
      const updated = await apply();
      assert.equal(updated.counts.update, 1, JSON.stringify(updated.rows));
      const saved = await Product.findOne({ sku: example.sku }).lean();
      assert.equal(saved.stock, 7);
      assert.deepEqual(
        await StockMovement.find({ product: saved._id, reason: 'import' })
          .distinct('delta')
          .then((values) => values.sort((a, b) => a - b)),
        [3, 4],
      );
      const racing = await submit(8);
      await Product.updateOne(
        { sku: example.sku },
        { $set: { description: 'Admin edited meanwhile.' } },
      );
      assert.equal((await racing()).counts.error, 1);
      const result = await Product.findOne({ sku: example.sku }).lean();
      assert.equal(result.stock, 7);
      assert.equal(result.description, 'Admin edited meanwhile.');
    },
  );

  await t.test(
    'valid ZIP images are attached on apply; traversal, bombs, macros and oversize are rejected',
    async () => {
      const photo = await sharp({
        create: { width: 4, height: 4, channels: 3, background: 'black' },
      })
        .png()
        .toBuffer();
      const input = {
        ...example,
        sku: 'ZIP-1',
        slug: 'zip-images-example',
        images: undefined,
        imageAlts: undefined,
      };
      const content = await sheetFor([input]);
      const zip = await zipFiles([['photos/ZIP-1.png', photo]]);
      const data = (proof, archive = zip) =>
        form('images.csv', content, { mode: 'create', proof, zip: archive });
      const preview = await post('/preview', data());
      assert.equal(preview.counts.create, 1);
      assert.equal(await Product.countDocuments({ sku: input.sku }), 0);
      assert.equal((await post('/apply', data(preview.proof))).counts.create, 1);
      const product = await Product.findOne({ sku: input.sku }).lean();
      assert.match(product.images[0], /^\/api\/uploads\/.+\.webp$/);
      assert.equal((await fetch(origin + product.images[0].replace('/api', ''))).status, 200);

      const unsafe = await zipFiles([['AA/evil.png', photo]]);
      for (
        let offset = unsafe.indexOf('AA/evil.png');
        offset >= 0;
        offset = unsafe.indexOf('AA/evil.png', offset + 1)
      )
        unsafe.write('../evil.png', offset);
      await post('/preview', data(undefined, unsafe), 400);
      const bomb = await zipFiles([['ZIP-1.png', Buffer.alloc(sheetMaxBytes + 1)]]);
      await post('/preview', data(undefined, bomb), 413);
      await post(
        '/preview',
        form('huge.csv', Buffer.alloc(sheetMaxBytes + 1), { mode: 'create' }),
        413,
      );
      const macros = await zipFiles([['xl/vbaProject.bin', Buffer.from('rejected')]]);
      await post('/preview', form('macro.xlsx', macros, { mode: 'create' }), 400);
      const tooMany = 'sku\n' + Array.from({ length: 501 }, (_, index) => 'SKU' + index).join('\n');
      await post('/preview', form('rows.csv', tooMany, { mode: 'create' }), 413);
    },
  );

  await t.test(
    'download endpoints include template examples and opt in to private cost',
    async () => {
      const login = await fetch(origin + '/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.test', password: 'sample-password' }),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.getSetCookie()[0].split(';', 1)[0];
      const download = async (query) => {
        const response = await fetch(origin + base + query, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-disposition'), /^attachment/);
        return Buffer.from(await response.arrayBuffer());
      };
      const template = await download('/template?format=xlsx');
      const rows = await parseProductSheet({ name: 'template.xlsx', bytes: template });
      assert.deepEqual(
        rows.map(({ data }) => data.productType),
        ['diecast', 'rc'],
      );
      const exported = await download('/export?format=csv');
      assert.ok(!exported.toString().split('\r\n')[0].includes('costPrice'));
      const withCost = await download('/export?format=csv&includeCost=true');
      const products = await parseProductSheet({ name: 'products.csv', bytes: withCost });
      assert.equal(products.find(({ data }) => data.sku === example.sku).data.costPrice, '120');
    },
  );

  await t.test('prefill parses a single unsaved row and denies staff access', async () => {
    const { values, issues, publishing } = await post(
      '/prefill',
      form(
        'prefill.json',
        JSON.stringify({
          sku: 'PREFILL-01',
          name: 'Prefilled name',
          price: 0,
          weightGrams: 20,
        }),
      ),
    );
    assert.equal(values.price, 0);
    assert.ok(issues.some(({ field }) => field === 'slug'));
    assert.ok(publishing.some(({ field }) => field === 'mrp'));
    assert.equal(await Product.countDocuments({ sku: 'PREFILL-01' }), 0);
    const draft = await admin('/admin/products/' + example.slug + '/duplicate', {
      method: 'POST',
      body: { includeImages: false, suggestSku: true },
    });
    assert.match(draft.value.sku, /-COPY-/);
    assert.deepEqual(draft.value.images, []);
    assert.equal(draft.value.stock, 0);
    assert.equal(await Product.countDocuments({ slug: draft.value.slug }), 0);

    const staff = shopper(origin);
    await staff('/auth/register', {
      method: 'POST',
      status: 201,
      body: { name: 'Staff test', email: 'staff@example.test', password: 'staff-password' },
    });
    for (const path of ['/template', '/export', '/history'])
      await staff(base + path, { status: 403 });
    await staff(base + '/preview', {
      method: 'POST',
      raw: form('test.csv', 'sku\nITEM', { mode: 'create' }),
      status: 403,
    });
    assert.deepEqual((await admin(base + '/capabilities')).value, { extraction: false });
  });
});
