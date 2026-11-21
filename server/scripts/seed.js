// Inserts missing sample products while preserving existing listings.
import mongoose from 'mongoose';
import { connectDatabase } from '../src/services/database.js';
import { Product } from '../src/models/product.js';
import { productInput } from '../src/utils/product-input.js';
import { seedProducts } from './products.js';
import { rcSamples } from './rc-products.js';

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
  for (const { slug, glbUrl } of seedProducts.filter((item) => item.glbUrl)) {
    await Product.updateOne({ slug, glbUrl: { $exists: false } }, { $set: { glbUrl } });
  }
  process.stdout.write(
    `Added ${result.upsertedCount} sample products. ${result.matchedCount} already existed.\n`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
