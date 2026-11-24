// Assembles HTTP middleware and mounts the store's public and admin routes.
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, HttpError } from './utils/http-error.js';
import { createAuthRouter } from './routes/auth.js';
import { createCartRouter } from './routes/cart.js';
import { readOrderRetentionDays } from './config/store-policy.js';
import { createSettingsService, settingsDefaults } from './services/store-settings.js';
import { createStoreSettingsRouter, storeInfo } from './routes/store-settings.js';
import { createCouponInitializer } from './services/discounts.js';
import { createCouponsRouter } from './routes/coupons.js';
import { createBlockedContactsRouter } from './routes/blocked-contacts.js';
import { readAppOptions } from './utils/config.js';
import { createOrdersRouter, createAdminOrdersRouter } from './routes/orders.js';
import { createAdminSupportRouter, createSupportRouter } from './routes/support.js';
import { createAdminNewsletterRouter, createNewsletterRouter } from './routes/newsletter.js';
import { createReviewsRouter } from './routes/reviews.js';
import { productsRouter } from './routes/products.js';
import { createShopper } from './middleware/shopper.js';
import { deliveryHandler } from './controllers/delivery.js';
import { identifyRequest, protectWrites, requestLimit } from './middleware/http.js';
import { createShopAccountRouter } from './routes/shop-account.js';
import { createAdminProductsRouter } from './routes/admin-products.js';
import { createSession } from './middleware/session.js';

export function createApp({ orderEmailEnabled = false } = {}) {
  const app = express();
  const { production, origins, secret, businessSecret, payment: paymentOptions } = readAppOptions();
  const session = createSession(secret, production);
  const shopper = createShopper(session, secret, production);
  const settings = createSettingsService(settingsDefaults(paymentOptions));
  const initializeCoupons = createCouponInitializer(paymentOptions.couponDefaults);
  const payment = {
    ...paymentOptions,
    settings,
    initializeCoupons,
    orderEmailEnabled,
    riskSecret: businessSecret,
  };

  app.use(identifyRequest);
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
  app.use('/newsletter', createNewsletterRouter(session, businessSecret));
  app.use('/admin/newsletter', createAdminNewsletterRouter(session.requireUser, businessSecret));
  app.use('/support', createSupportRouter(session));
  app.use('/admin/support', createAdminSupportRouter(session.requireUser));
  app.use('/auth', createAuthRouter(session));
  app.use('/cart', createCartRouter(shopper, payment));
  app.use('/account', createShopAccountRouter(session, readOrderRetentionDays()));
  app.get(['/store-info', '/api/store-info'], storeInfo(settings));
  app.use('/admin/settings', createStoreSettingsRouter(session, settings));
  app.use('/admin/coupons', createCouponsRouter(session.requireUser, initializeCoupons));
  app.use('/admin/blocked-contacts', createBlockedContactsRouter(session.requireUser));
  app.get('/delivery', deliveryHandler(payment));
  app.use('/orders', createOrdersRouter(session.requireUser, shopper, payment));
  app.use('/admin/products', createAdminProductsRouter(session.requireUser));
  app.use('/admin/orders', createAdminOrdersRouter(session.requireUser, payment));
  app.use(() => {
    throw new HttpError(404, 'Route not found.');
  });
  app.use(errorHandler);
  return app;
}
