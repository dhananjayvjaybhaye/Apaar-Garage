import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedProducts } from '../scripts/products.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

const [car] = seedProducts;
const productPath = (slug) => '/admin/products/' + slug;
const post = (body, status) => ({ method: 'POST', body, status });
const patch = (body, status) => ({ method: 'PATCH', body, status });
const add = (buyer, slug) => buyer('/cart/items', post({ slug, quantity: 1 }));

test('catalog publication and privacy', async (t) => {
  const origin = await startStore(t);
  const admin = await makeAdmin(origin);
  const newBuyer = () => shopper(origin);
  await t.test(
    'product compliance reports all missing fields and keeps costPrice admin-only',
    async () => {
      const {
        status: _status,
        mrp: _mrp,
        gstRatePercent: _gst,
        hsnCode: _hsn,
        manufacturerName: _name,
        manufacturerAddress: _address,
        ...stockItem
      } = car;
      const draft = {
        ...stockItem,
        slug: 'compliance-test',
        sku: 'TEST-01',
        productType: 'diecast',
        stock: 1,
        costPrice: 123.45,
        ageGradeMin: 8,
      };
      await admin('/admin/products', post(draft, 201));
      const missing = await admin(productPath(draft.slug), patch({ status: 'published' }, 400));
      assert.deepEqual(
        new Set(missing.value.details.map(({ field }) => field)),
        new Set([
          'mrp',
          'gstRatePercent',
          'hsnCode',
          'manufacturerOrImporter',
          'bisCertified',
          'bisLicenceNumber',
        ]),
      );
      await newBuyer()('/products/' + draft.slug, { status: 404 });
      await newBuyer()(productPath(draft.slug), { status: 401 });

      const published = await admin(
        productPath(draft.slug),
        patch({
          status: 'published',
          mrp: draft.price,
          gstRatePercent: 18,
          hsnCode: '9503',
          bisCertified: true,
          bisLicenceNumber: 'TEST-LICENCE',
          importerName: 'Test Importer',
          importerAddress: 'Test Address',
          placeholder: false,
        }),
      );
      assert.equal(published.value.costPrice, 123.45);
      assert.equal((await admin(productPath(draft.slug))).value.costPrice, 123.45);
      await admin('/admin/products', post({ ...draft, slug: 'duplicate-sku' }, 409));

      const buyer = newBuyer();
      await buyer(
        '/auth/register',
        post(
          {
            email: 'catalog-buyer@example.test',
            name: 'Catalog Buyer',
            password: 'sample-password',
          },
          201,
        ),
      );
      await buyer(productPath(draft.slug), { status: 403 });
      const invalidMrp = await admin(productPath(draft.slug), patch({ mrp: draft.price - 1 }, 400));
      assert.equal(invalidMrp.value.details[0].field, 'mrp');
      const responses = [
        await buyer('/products/' + draft.slug),
        await buyer('/products?q=' + encodeURIComponent(draft.name)),
        await add(buyer, draft.slug),
        await buyer('/orders/quote'),
      ];
      assert.ok(responses.every(({ value }) => !JSON.stringify(value).includes('costPrice')));
      const {
        value: { orderNumber },
      } = await buyer('/orders', post({ acceptPolicies: true, address }, 201));
      assert.ok(
        !JSON.stringify((await buyer('/orders/' + orderNumber)).value).includes('costPrice'),
      );
      const former = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        await buyer('/products/' + car.slug, { status: 404 });
        assert.deepEqual(
          (await buyer('/products')).value.items.map(({ slug }) => slug),
          [draft.slug],
        );
      } finally {
        process.env.NODE_ENV = former;
      }
    },
  );
});
