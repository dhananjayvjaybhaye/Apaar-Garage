// Builds product queries and maps database records to the public catalog.
import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';
import { categoriesByType, productCategories, rcCategories } from '../utils/product-input.js';

const sorting = {
  featured: { featured: -1, slug: 1 },
  newest: { _id: -1 },
  'price-asc': { price: 1, slug: 1 },
  'price-desc': { price: -1, slug: 1 },
  name: { name: 1, slug: 1 },
  popular: { sales: -1, featured: -1, slug: 1 },
};

function publicProduct({ _id, ratingTotal, ratingCount = 0, ...product }) {
  return {
    productType: rcCategories.includes(product.category) ? 'rc' : 'diecast',
    ...product,
    ratingCount,
    ratingAverage: ratingCount ? Math.round((ratingTotal * 10) / ratingCount) / 10 : null,
    addedAt: _id.getTimestamp().toISOString(),
  };
}

function productScope(query) {
  const {
    category,
    productType,
    skillLevel,
    age,
    batteryIncluded,
    controlType,
    terrain,
    brand,
    scale,
    q,
    minPrice,
    maxPrice,
    featured,
    inStock,
    slugs,
  } = query;
  const scopeType =
    productType ?? (category ? (rcCategories.includes(category) ? 'rc' : 'diecast') : undefined);
  const typeScope = scopeType ? { category: { $in: categoriesByType[scopeType] } } : {};
  const filter = {
    ...typeScope,
    ...(category && { category }),
    ...(skillLevel && { skillLevel }),
    ...(age !== undefined && { recommendedAge: { $lte: age } }),
    ...(batteryIncluded !== undefined && { batteryIncluded }),
    ...(controlType && { controlType }),
    ...(terrain && { terrain }),
    ...(brand && { brand }),
    ...(scale && { scale }),
    ...(featured && { featured: true }),
    ...(inStock && { stock: { $gt: 0 } }),
    ...(slugs && { slug: { $in: slugs } }),
  };

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {
      ...(minPrice !== undefined && { $gte: minPrice }),
      ...(maxPrice !== undefined && { $lte: maxPrice }),
    };
  }
  if (q) {
    const term = new RegExp(RegExp.escape(q), 'i');
    const tokens = q.toLowerCase().split(/[\s-]+/);
    const type = tokens[0] === 'rc' || tokens[0] === 'diecast' ? tokens.shift() : undefined;
    const categoryNames = tokens
      .join(' ')
      .replace(/^accessories$/, 'accessory')
      .replace(/s$/, '');
    const matchingCategories = productCategories.filter(
      (category) =>
        (!type || categoriesByType[type].includes(category)) &&
        (category.replace(/^rc-/, '') === categoryNames ||
          (type && ['', 'toy', 'model'].includes(categoryNames))),
    );
    filter.$or = [
      { name: term },
      { brand: term },
      { scale: term },
      { description: term },
      { batteryType: term },
      { skillLevel: term },
      { controlType: term },
      { terrain: term },
      ...(matchingCategories.length ? [{ category: { $in: matchingCategories } }] : []),
    ];
  }
  return { filter, typeScope };
}

export async function listProducts(query) {
  const { page, limit, facets, sort } = query;
  const { filter, typeScope } = productScope(query);
  const [total, brands, scales] = await Promise.all([
    Product.countDocuments(filter),
    facets ? Product.distinct('brand', typeScope) : [],
    facets ? Product.distinct('scale', typeScope) : [],
  ]);
  const totalPages = Math.ceil(total / limit);
  const items =
    page > totalPages
      ? []
      : await Product.find(filter)
          .select('-__v')
          .sort(sorting[sort])
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();
  return {
    items: items.map(publicProduct),
    page,
    limit,
    total,
    totalPages,
    ...(facets && {
      facets: {
        brands: brands.sort((a, b) => a.localeCompare(b)),
        scales: scales.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      },
    }),
  };
}

export async function findProduct(slug) {
  const product = await Product.findOne({ slug: slug }).select('-__v').lean();
  if (!product) throw new HttpError(404, 'Product not found.');
  return publicProduct(product);
}
