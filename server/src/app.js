// Assembles HTTP middleware and mounts the store's public and admin routes.
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, HttpError } from './utils/http-error.js';
import { createAuthRouter } from './routes/auth.js';
import { createCartRouter } from './routes/cart.js';
import { readAppOptions } from './utils/config.js';
import { createOrdersRouter, createAdminOrdersRouter } from './routes/orders.js';
import { supportRouter } from './routes/support.js';
import { newsletterRouter } from './routes/newsletter.js';
import { createReviewsRouter } from './routes/reviews.js';
import { productsRouter } from './routes/products.js';
import { createShopper } from './middleware/shopper.js';
import { deliveryHandler } from './controllers/delivery.js';
import { protectWrites, requestLimit } from './middleware/http.js';
import { createShopAccountRouter } from './routes/shop-account.js';
import { createSession } from './middleware/session.js';

export function createApp({ orderEmailEnabled = false } = {}) {
  const app = express();
  const { production, origins, secret, payment: paymentOptions } = readAppOptions();
  const session = createSession(secret, production);
  const shopper = createShopper(session, secret, production);
  const payment = { ...paymentOptions, orderEmailEnabled };

  app.use(
    helmet({
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(cors({ origin: origins, credentials: true }));
  app.use(requestLimit({ limit: 300, message: 'Too many requests. Try again later.' }));
  app.use(protectWrites(origins));
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use('/products', createReviewsRouter(shopper), productsRouter);
  app.use('/newsletter', newsletterRouter);
  app.use('/support', supportRouter);
  app.use('/auth', createAuthRouter(session));
  app.use('/cart', createCartRouter(shopper, payment));
  app.use('/account', createShopAccountRouter(session.requireUser));
  app.get('/delivery', deliveryHandler(payment));
  app.use('/orders', createOrdersRouter(session.requireUser, shopper, payment));
  app.use('/admin/orders', createAdminOrdersRouter(session.requireUser, payment));
  app.use(() => {
    throw new HttpError(404, 'Route not found.');
  });
  app.use(errorHandler);
  return app;
}
