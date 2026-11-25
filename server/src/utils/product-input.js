import { z } from 'zod';
import { productMetadataLimits as metadata } from '../config/product-metadata.js';
import { productBusinessInput } from './product-business-input.js';
import { publicationIssues, validRupeeAmount } from './product-compliance.js';

export const diecastCategories = ['car', 'truck', 'bike'];
export const rcCategories = [
  'rc-car',
  'rc-truck',
  'rc-plane',
  'rc-boat',
  'rc-drone',
  'rc-bike',
  'rc-accessory',
];
export const categoriesByType = { diecast: diecastCategories, rc: rcCategories };
export const productCategories = [...diecastCategories, ...rcCategories];
export const productTypes = ['diecast', 'rc'];
export const controlTypes = ['2.4GHz', 'Wi-Fi', 'app'];
export const terrains = ['indoor', 'outdoor', 'all-terrain'];
export const skillLevels = ['beginner', 'intermediate', 'expert'];
export const maxRecommendedAge = 99;
// Slugs are URL path segments, capped to the same length as cart slugs.
export const productSlug = z
  .string()
  .max(150, 'Invalid product slug.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid product slug.');

const scale = z
  .string()
  .trim()
  .regex(/^1:[1-9][0-9]*$/, 'Enter a scale like 1:64.');
const positive = z.number().positive();
const text = z.string().trim().min(1);
const whole = z.int().nonnegative();
const common = z.object({
  ...productBusinessInput,
  name: text,
  slug: productSlug,
  brand: text,
  price: z.number().refine(validRupeeAmount, 'Enter a nonnegative price with up to two decimals.'),
  stock: whole,
  warrantyDays: whole.optional(),
  images: z.array(text).nonempty('Add at least one product image.'),
  imageAlts: z.array(z.string().trim().max(220)).optional(),
  glbUrl: text.optional(),
  description: text,
  tags: z.array(text.max(metadata.tagLength)).max(metadata.tagCount).optional(),
  seoTitle: text.max(metadata.titleLength).optional(),
  seoDescription: text.max(metadata.descriptionLength).optional(),
  featured: z.boolean().default(false),
  placeholder: z.boolean().optional(),
  dimensionsMm: z
    .object({
      length: positive.optional(),
      width: positive.optional(),
      height: positive.optional(),
    })
    .optional(),
});

// Shared write validation for seed data and the future product editor.
export const productFields = z.discriminatedUnion('productType', [
  common.extend({ productType: z.literal('diecast'), category: z.enum(diecastCategories), scale }),
  common.extend({
    productType: z.literal('rc'),
    category: z.enum(rcCategories),
    scale: scale.optional(),
    batteryType: text.optional(),
    batteryIncluded: z.boolean(),
    runTime: positive.optional(),
    chargeTime: positive.optional(),
    topSpeed: positive.optional(),
    controlRange: positive.optional(),
    controlType: z.enum(controlTypes).optional(),
    terrain: z.enum(terrains).optional(),
    skillLevel: z.enum(skillLevels),
    recommendedAge: z.int().min(1).max(maxRecommendedAge),
    readyToRun: z.boolean(),
    warrantyDays: whole,
    boxContents: z.array(text).nonempty('List at least one item included in the box.'),
  }),
]);

export const productInput = productFields.superRefine((product, context) => {
  if (product.imageAlts && product.imageAlts.length !== product.images.length) {
    context.addIssue({
      code: 'custom',
      path: ['imageAlts'],
      message: 'Alt text must match the image order.',
    });
  }
  for (const { field, message } of publicationIssues(product)) {
    context.addIssue({ code: 'custom', path: [field], message });
  }
});
