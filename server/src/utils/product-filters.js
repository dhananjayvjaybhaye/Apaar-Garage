// Validates the catalog query string before any database work.
import { z } from 'zod';
import {
  categoriesByType,
  controlTypes,
  maxRecommendedAge,
  productCategories,
  productTypes,
  skillLevels,
  terrains,
} from './product-input.js';

const maxSlugQueryLength = 15099;
const number = (pattern) =>
  z.string().regex(pattern).transform(Number).pipe(z.number().nonnegative());
const integer = number(/^[1-9][0-9]*$/).pipe(z.int().positive());
const price = number(/^\d{1,9}(?:\.\d{1,2})?$/);
export const productFilters = z
  .object({
    category: z.enum(productCategories).optional(),
    productType: z.enum(productTypes).optional(),
    skillLevel: z.enum(skillLevels).optional(),
    age: integer.pipe(z.int().max(maxRecommendedAge)).optional(),
    batteryIncluded: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    controlType: z.enum(controlTypes).optional(),
    terrain: z.enum(terrains).optional(),
    brand: z.string().trim().min(1).max(100).optional(),
    scale: z
      .string()
      .regex(/^1:[1-9]\d*$/)
      .optional(),
    q: z.string().trim().max(80).optional(),
    minPrice: price.optional(),
    maxPrice: price.optional(),
    featured: z.literal('true').optional(),
    facets: z.literal('true').optional(),
    inStock: z.literal('true').optional(),
    slugs: z
      .string()
      .max(maxSlugQueryLength)
      .regex(/^[a-z0-9,-]+$/)
      .transform((value) => value.split(','))
      .optional(),
    sort: z
      .enum(['featured', 'newest', 'price-asc', 'price-desc', 'name', 'popular'])
      .default('featured'),
    page: integer.default(1),
    limit: integer.pipe(z.int().max(100)).default(8),
  })
  .refine(
    (query) =>
      query.maxPrice === undefined ||
      query.minPrice === undefined ||
      query.minPrice <= query.maxPrice,
    { message: 'Maximum price must be at least the minimum price.' },
  )
  .refine(
    ({ category, productType }) =>
      !category || !productType || categoriesByType[productType].includes(category),
    { message: 'Category does not match the product type.', path: ['category'] },
  )
  .refine(
    ({ category, productType, skillLevel, age, batteryIncluded, controlType, terrain }) =>
      !(productType === 'diecast' || categoriesByType.diecast.includes(category)) ||
      [skillLevel, age, batteryIncluded, controlType, terrain].every(
        (value) => value === undefined,
      ),
    { message: 'RC filters require an RC category or product type.' },
  );
