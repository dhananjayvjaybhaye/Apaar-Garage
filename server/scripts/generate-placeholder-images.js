import { mkdir, writeFile } from 'node:fs/promises';
import { renderPlaceholder } from './placeholder-art.js';
import { seedProducts } from './products.js';
import { rcSamples } from './rc-products.js';

const output = new URL('../../client/public/', import.meta.url);
await mkdir(new URL('images/placeholders/', output), { recursive: true });
const products = [...seedProducts, ...rcSamples];
await Promise.all(
  products.map((product, index) =>
    writeFile(new URL(product.images[0].slice(1), output), renderPlaceholder(product, index)),
  ),
);
process.stdout.write(`Generated ${products.length} sample catalog illustrations.\n`);
