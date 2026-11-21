// Inserts missing sample products while preserving existing listings.
import mongoose from 'mongoose';
import { connectDatabase } from '../src/services/database.js';
import { Product } from '../src/models/product.js';
import { productInput } from '../src/utils/product-input.js';
import { seedProducts } from './products.js';
import { rcSamples } from './rc-products.js';
import { legacyDiecast } from './legacy-diecast.js';

function oldSample(item) {
  if (item.productType === 'diecast') return legacyDiecast[item.slug];
  return {
    name: item.name,
    brand: 'Apaar RC Samples',
    description: item.description,
    images: ['/images/rc-sample.png'],
    placeholder: true,
  };
}

try {
  await connectDatabase();
  await Product.init();
  const samples = [
    ...seedProducts.map((item) => ({ ...item, productType: 'diecast' })),
    ...rcSamples,
  ].map((item) => productInput.parse(item));
  const products = samples.map((item) => new Product(item));
  await Promise.all(products.map((product) => product.validate()));
  const result = await Product.bulkWrite(
    samples.map((item) => ({
      updateOne: {
        filter: { slug: item.slug },
        update: { $setOnInsert: item },
        upsert: true,
      },
    })),
  );
  // Refresh only untouched legacy sample artwork and copy. Keep stock, prices and existing links.
  const refresh = await Product.bulkWrite(
    samples.map((item) => ({
      updateOne: {
        filter: { slug: item.slug, ...oldSample(item) },
        update: {
          $set: {
            name: item.name,
            brand: item.brand,
            description: item.description,
            images: item.images,
            placeholder: true,
          },
        },
      },
    })),
  );
  for (const { slug, glbUrl, images } of seedProducts.filter((item) => item.glbUrl)) {
    await Product.updateOne(
      { slug, images, placeholder: true, glbUrl: { $exists: false } },
      { $set: { glbUrl } },
    );
  }
  process.stdout.write(
    `Added ${result.upsertedCount} samples. Refreshed ${refresh.modifiedCount} legacy samples.\n`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
