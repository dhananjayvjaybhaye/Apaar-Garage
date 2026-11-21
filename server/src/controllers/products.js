// Adapts catalog queries and product lookups to HTTP responses.
import { validate } from '../utils/http-error.js';
import { productFilters } from '../utils/product-filters.js';
import { findProduct, listProducts } from '../services/product-catalog.js';

export async function getProducts(req, res) {
  const query = validate(productFilters, req.query);
  const result = await listProducts(query);
  res.set('Cache-Control', query.inStock ? 'public, no-cache' : 'public, max-age=20');
  res.json(result);
}

export async function getProduct(req, res) {
  const product = await findProduct(req.params.slug);
  res.set('Cache-Control', 'public, no-cache').json(product);
}
