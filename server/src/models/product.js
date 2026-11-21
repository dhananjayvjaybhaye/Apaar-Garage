import mongoose from 'mongoose';
import {
  categoriesByType,
  controlTypes,
  maxRecommendedAge,
  productCategories,
  productTypes,
  skillLevels,
  terrains,
} from '../utils/product-input.js';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  productType: { type: String, enum: productTypes, required: true, default: 'diecast' },
  category: { type: String, required: true, enum: productCategories },
  brand: { type: String, required: true, trim: true },
  scale: {
    type: String,
    required() {
      return this.productType === 'diecast';
    },
    trim: true,
    match: /^1:[1-9][0-9]*$/,
  },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  images: {
    type: [String],
    required: true,
    validate: (images) => images.length > 0 && images.every((image) => image.trim()),
  },
  ratingCount: { type: Number, default: 0, min: 0 },
  ratingTotal: { type: Number, default: 0, min: 0 },
  sales: { type: Number, default: 0, min: 0 },
  dimensionsMm: { length: Number, width: Number, height: Number },
  glbUrl: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  featured: { type: Boolean, default: false },
  batteryType: { type: String, trim: true },
  batteryIncluded: Boolean,
  runTime: { type: Number, validate: (value) => value > 0 },
  chargeTime: { type: Number, validate: (value) => value > 0 },
  topSpeed: { type: Number, validate: (value) => value > 0 },
  controlRange: { type: Number, validate: (value) => value > 0 },
  controlType: { type: String, enum: controlTypes },
  terrain: { type: String, enum: terrains },
  skillLevel: { type: String, enum: skillLevels },
  recommendedAge: { type: Number, min: 1, max: maxRecommendedAge, validate: Number.isSafeInteger },
  readyToRun: Boolean,
  warrantyDays: { type: Number, min: 0, validate: Number.isSafeInteger },
  boxContents: { type: [String], default: undefined },
  placeholder: Boolean,
});

productSchema.pre('validate', function () {
  if (this.category && !categoriesByType[this.productType]?.includes(this.category)) {
    this.invalidate('category', 'Choose a category for this product type.');
  }
});

productSchema.index({ featured: -1, slug: 1 });
productSchema.index({ category: 1, featured: -1, slug: 1 });

export const Product = mongoose.model('Product', productSchema);
