import yazl from 'yazl';
import { productRecords, sheetStream } from '../src/utils/product-sheet.js';

const example = {
  sku: 'IM-117',
  slug: 'import-test-coupe',
  name: '+Collectible Coupe',
  brand: 'Test maker',
  productType: 'diecast',
  category: 'car',
  scale: '1:64',
  price: 600,
  stock: 4,
  status: 'published',
  description: '=this is listing text',
  costPrice: 120,
  images: ['/listing-coupe.webp'],
  imageAlts: ['Front view'],
  tags: ['Display', '@seller'],
  dimensionsMm: { height: 30 },
};

const bytes = async (stream) =>
  Buffer.concat((await stream.toArray()).map((piece) => Buffer.from(piece)));
const sheetFor = (products, format = 'csv', includeCost = true) =>
  bytes(sheetStream(format, productRecords(products, includeCost)));

function zipFiles(entries) {
  const zip = new yazl.ZipFile();
  for (const [name, content] of entries) zip.addBuffer(content, name);
  zip.end();
  return bytes(zip.outputStream);
}

export { example, sheetFor, zipFiles };
