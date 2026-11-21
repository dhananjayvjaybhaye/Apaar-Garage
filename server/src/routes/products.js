import { Router } from 'express';
import { getProduct, getProducts } from '../controllers/products.js';

export const productsRouter = Router();
productsRouter.get('/', getProducts);
productsRouter.get('/:slug', getProduct);
