import { z } from 'zod';
import { adminProductPageSize } from '../config/admin-panel.js';
import { certificationAge, productStatuses } from '../config/business.js';
import { Product } from '../models/product.js';
import { productCategories, productTypes } from '../utils/product-input.js';
import { publicationIssues, publicationFields } from '../utils/product-compliance.js';
import { lowStockFilter } from './admin-dashboard.js';

const sorts = {
  newest: { _id: -1 },
  name: { name: 1, _id: 1 },
  'name-desc': { name: -1, _id: 1 },
  'price-asc': { price: 1, _id: 1 },
  'price-desc': { price: -1, _id: 1 },
  'stock-asc': { stock: 1, _id: 1 },
};
export const adminProductQuery = z.strictObject({
  q: z.string().trim().max(120).optional(),
  productType: z.enum(productTypes).optional(),
  category: z.enum(productCategories).optional(),
  status: z.enum(productStatuses).optional(),
  stock: z.enum(['in', 'low', 'out']).optional(),
  compliance: z.enum(['complete', 'incomplete']).optional(),
  sort: z.enum(Object.keys(sorts)).default('newest'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
const present = (field) => ({ $not: [{ $in: [{ $ifNull: ['$' + field, null] }, [null, '']] }] });
const complete = {
  $and: [
    ...publicationFields.map(present),
    { $gte: ['$mrp', '$price'] },
    {
      $or: [
        { $and: ['manufacturerName', 'manufacturerAddress'].map(present) },
        { $and: ['importerName', 'importerAddress'].map(present) },
      ],
    },
    {
      $or: [
        { $eq: ['$category', 'rc-accessory'] },
        { $gte: ['$ageGradeMin', certificationAge] },
        { $and: [{ $eq: ['$bisCertified', true] }, present('bisLicenceNumber')] },
      ],
    },
  ],
};

export async function listAdminProducts(query, includeCost = false) {
  const { q, productType, category, stock, status, compliance, sort, page } = query;
  const criteria = {
    ...(productType && { productType }),
    ...(category && { category }),
    ...(status === 'draft'
      ? { $or: [{ status }, { status: { $exists: false } }] }
      : status && { status }),
    ...(stock === 'in' && { stock: { $gt: 0 } }),
    ...(stock === 'out' && { stock: 0 }),
  };
  const conditions = [criteria];
  if (stock === 'low') conditions.push(lowStockFilter);
  if (compliance)
    conditions.push({ $expr: compliance === 'complete' ? complete : { $not: [complete] } });
  if (q) {
    const term = new RegExp(RegExp.escape(q), 'i');
    conditions.push({
      $or: ['name', 'slug', 'sku', 'brand', 'barcode'].map((field) => ({ [field]: term })),
    });
  }
  const where = { $and: conditions };
  const [total, products] = await Promise.all([
    Product.countDocuments(where),
    Product.find(where)
      .select(includeCost ? '+costPrice' : '-costPrice')
      .sort(sorts[sort])
      .skip((page - 1) * adminProductPageSize)
      .limit(adminProductPageSize)
      .lean(),
  ]);
  const items = products.map((product) => {
    const { slug, name, sku, price, stock, brand, category, productType, placeholder, images } =
      product;
    return {
      slug,
      name,
      sku,
      price,
      stock,
      brand,
      category,
      productType,
      status: product.status ?? 'draft',
      placeholder: Boolean(placeholder),
      image: images[0],
      ...(includeCost && product.costPrice !== undefined && { costPrice: product.costPrice }),
      issues: publicationIssues({ ...product, status: 'published' }),
    };
  });
  return { items, total, page, pages: Math.max(1, Math.ceil(total / adminProductPageSize)) };
}
