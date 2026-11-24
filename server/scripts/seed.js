// Inserts sample stock transactionally and upgrades only known placeholder listings.
import mongoose from 'mongoose';
import { connectDatabase } from '../src/services/database.js';
import { Product } from '../src/models/product.js';
import { StockMovement } from '../src/models/stock-movement.js';
import { productInput } from '../src/utils/product-input.js';
import { applyStockMovements } from '../src/services/stock.js';
import { transaction } from '../src/services/transaction.js';
import { seedProducts } from './products.js';
import { rcSamples } from './rc-products.js';
import { legacyDiecast } from './legacy-diecast.js';
import { sampleCompliance } from './sample-compliance.js';

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

async function seedSample(item) {
  return transaction(async (session) => {
    const result = await Product.updateOne(
      { slug: item.slug },
      {
        $setOnInsert: { ...item, stock: 0 },
      },
      { upsert: true, session },
    );
    if (result.upsertedCount) {
      await applyStockMovements([{ product: result.upsertedId, delta: item.stock }], {
        reason: 'opening',
        session,
      });
    }
    const legacy = oldSample(item);
    const refresh = legacy
      ? await Product.updateOne(
          { slug: item.slug, ...legacy },
          {
            $set: {
              name: item.name,
              brand: item.brand,
              description: item.description,
              images: item.images,
              placeholder: true,
            },
          },
          { session },
        )
      : null;
    if (item.glbUrl) {
      await Product.updateOne(
        { slug: item.slug, images: item.images, placeholder: true, glbUrl: { $exists: false } },
        { $set: { glbUrl: item.glbUrl } },
        { session },
      );
    }

    const unpublished = await Product.findOne({
      slug: item.slug,
      placeholder: true,
      status: { $exists: false },
    })
      .session(session)
      .lean();
    if (unpublished) {
      const defaults = sampleCompliance(unpublished);
      const missing = Object.fromEntries(
        Object.entries(defaults).filter(([key]) => unpublished[key] == null),
      );
      const upgrade = new Product({ ...unpublished, ...missing });
      await upgrade.validate();
      await Product.updateOne(
        { _id: unpublished._id, status: { $exists: false } },
        { $set: missing },
        { session },
      );
    }
    return {
      added: result.upsertedCount,
      refreshed: refresh?.modifiedCount ?? 0,
      migrated: Number(Boolean(unpublished)),
    };
  });
}

try {
  await connectDatabase();
  await Promise.all([Product.init(), StockMovement.init()]);
  const samples = [
    ...seedProducts.map((item) => ({ ...item, productType: 'diecast' })),
    ...rcSamples,
  ];
  let added = 0;
  let refreshed = 0;
  let migrated = 0;
  for (const sample of samples) {
    const item = productInput.parse(sample);
    await new Product(item).validate();
    const result = await seedSample(item);
    added += result.added;
    refreshed += result.refreshed;
    migrated += result.migrated;
  }
  process.stdout.write(
    `Added ${added} samples. Refreshed ${refreshed} legacy samples. Upgraded ${migrated} sample listings.\n`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
