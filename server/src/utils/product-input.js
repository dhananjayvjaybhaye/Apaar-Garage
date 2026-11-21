import { z } from 'zod';

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
  .regex(/^1:[1-9][0-9]*$/);
const positive = z.number().positive();
const text = z.string().trim().min(1);
const whole = z.int().nonnegative();
const common = z.object({
  name: text,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brand: text,
  price: z.number().nonnegative(),
  stock: whole,
  images: z.array(text).nonempty(),
  glbUrl: text.optional(),
  description: text,
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
export const productInput = z.discriminatedUnion('productType', [
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
    boxContents: z.array(text).nonempty(),
  }),
]);
