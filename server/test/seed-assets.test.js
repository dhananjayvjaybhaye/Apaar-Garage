import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seedProducts } from '../scripts/products.js';
import { rcSamples } from '../scripts/rc-products.js';
import { renderPlaceholder } from '../scripts/placeholder-art.js';

test('all sample listings have their own reproducible placeholder artwork', async () => {
  const samples = [...seedProducts, ...rcSamples];
  assert.equal(seedProducts.length, 12);
  assert.equal(rcSamples.length, 15);
  assert.equal(new Set(samples.map((sample) => sample.name)).size, samples.length);
  assert.equal(new Set(samples.map((sample) => sample.images[0])).size, samples.length);
  await Promise.all(
    samples.map(async (sample, index) => {
      assert.equal(sample.placeholder, true);
      const art = await readFile(
        new URL('../../client/public' + sample.images[0], import.meta.url),
        'utf8',
      );
      assert.equal(art.replaceAll('\r\n', '\n'), renderPlaceholder(sample, index));
      assert.match(art, /SAMPLE ARTWORK/);
    }),
  );
});
