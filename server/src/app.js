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
import { identifyRequest, noStore, protectWrites, requestLimit } from './middleware/http.js';
import { createShopAccountRouter } from './routes/shop-account.js';
import { createAdminProductMediaRouter } from './routes/admin-product-media.js';
import { createProductMedia } from './services/product-media.js';
import { createAdminProductImportsRouter } from './routes/admin-product-imports.js';
import { configuredProductExtractor } from './services/product-extraction.js';
import { createAdminProductsRouter } from './routes/admin-products.js';
import { createAdminSessions } from './middleware/admin-session.js';
import { createAdminAuthRouter } from './routes/admin-auth.js';
import { createAdminOverviewRouter } from './routes/admin-overview.js';
import { createAdminFulfillmentRouter } from './routes/admin-fulfillment.js';
import { createSession } from './middleware/session.js';
import { requirePermission } from './middleware/administrator.js';
import { adminPermission } from './config/admin-permissions.js';

export function createApp({
  orderEmailEnabled = false,
  options = readAppOptions(),
  settings = createSettingsService(settingsDefaults(options.payment)),
  productMedia = options.productMedia,
  productExtractor = configuredProductExtractor(),
} = {}) {
  const app = express();
  const { production, origins, secret, businessSecret, payment: paymentOptions } = options;
  const session = createSession(secret, production);
  const admin = createAdminSessions(options.adminSecurity, session);
  const media = createProductMedia(productMedia);
  if (options.adminSecurity.trustLoopbackProxy) app.set('trust proxy', 'loopback');
  app.use(['/admin', '/auth/admin'], noStore);
  const shopper = createShopper(session, secret, production);
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
  const parseJson = express.json({ limit: '16kb' });
  app.use((req, res, next) => {
    // Settings can include 500 delivery rules and have a dedicated parser after owner verification.
    if (req.method === 'PUT' && /^\/admin\/settings\/?$/i.test(req.path)) return next();
    parseJson(req, res, next);
  });
  app.use(cookieParser());
  app.use('/products', createReviewsRouter(shopper), productsRouter);
  app.use('/newsletter', createNewsletterRouter(session, businessSecret));
  app.use('/admin/newsletter', createAdminNewsletterRouter(admin.requireAdmin, businessSecret));
  app.use('/support', createSupportRouter(session));
  app.use('/admin/support', createAdminSupportRouter(admin.requireAdmin));
  app.use('/auth/admin', createAdminAuthRouter(options.adminSecurity, admin));
  app.use('/auth', createAuthRouter(session));
  app.use('/admin/overview', createAdminOverviewRouter(admin.requireAdmin));
  app.use('/cart', createCartRouter(shopper, payment));
  app.use('/account', createShopAccountRouter(session, readOrderRetentionDays()));
  app.get(['/store-info', '/api/store-info'], storeInfo(settings));
  app.use('/admin/settings', createStoreSettingsRouter(admin.requireAdmin, settings));
  app.use('/admin/coupons', createCouponsRouter(admin.requireAdmin, initializeCoupons));
  app.use('/admin/blocked-contacts', createBlockedContactsRouter(admin.requireAdmin));
  app.get('/delivery', deliveryHandler(payment));
  app.use('/orders', createOrdersRouter(session.requireUser, shopper, payment));
  if (media.localDirectory)
    app.use('/uploads', express.static(media.localDirectory, { index: false, redirect: false }));
  app.use('/admin/media', createAdminProductMediaRouter(admin.requireAdmin, media));
  app.use(
    '/admin/product-imports',
    createAdminProductImportsRouter(admin.requireAdmin, {
      media,
      secret: businessSecret,
      extractor: productExtractor,
    }),
  );
  app.use('/admin/products', createAdminProductsRouter(admin.requireAdmin));
  app.use('/admin/orders', createAdminOrdersRouter(admin.requireAdmin, payment));
  app.use('/admin', createAdminFulfillmentRouter(admin.requireAdmin));
  app.use('/admin', admin.requireAdmin, requirePermission(adminPermission.adminUsers));
  app.use(() => {
    throw new HttpError(404, 'Route not found.');
  });
  app.use(errorHandler);
  return app;
}
