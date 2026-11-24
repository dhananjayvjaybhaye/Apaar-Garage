// Validates startup settings, connects MongoDB, and starts the API.
import { createApp } from './app.js';
import { connectDatabase, DatabaseConnectionError } from './services/database.js';
import mongoose from 'mongoose';
import { createOrderMailer, startOrderEmailWorker } from './services/order-email.js';
import { Coupon, CouponRedemption } from './models/coupon.js';
import { BlockedContact, CodLock } from './models/cod-risk.js';
import { StoreSettings } from './models/store-settings.js';
import { NewsletterSubscriber } from './models/newsletter-subscriber.js';
import { SupportRequest } from './models/support-request.js';
import { InvoiceCounter } from './models/invoice-counter.js';
import { Product } from './models/product.js';
import { ReturnRequest } from './models/return-request.js';
import { StockMovement } from './models/stock-movement.js';
import { Order } from './models/order.js';
import { CartItem } from './models/cart-item.js';
import { Review } from './models/review.js';
import { User } from './models/user.js';
import { bindAddress, readPort } from './utils/config.js';

try {
  const port = readPort();

  const mailer = createOrderMailer();
  const app = createApp({ orderEmailEnabled: Boolean(mailer) });
  await connectDatabase();
  await Promise.all([
    User.init(),
    CartItem.init(),
    Order.init(),
    Review.init(),
    Product.init(),
    InvoiceCounter.init(),
    ReturnRequest.init(),
    StockMovement.init(),
    Coupon.init(),
    CouponRedemption.init(),
    BlockedContact.init(),
    CodLock.init(),
    StoreSettings.init(),
    NewsletterSubscriber.init(),
    SupportRequest.init(),
  ]);

  app.listen(port, bindAddress, (error) => {
    if (error) {
      console.error('Could not start the API. Check that PORT is available.');
      process.exitCode = 1;
      void mongoose.disconnect().catch(() => undefined);
    }
    process.stdout.write(`Apaar Garage API listening at http://${bindAddress}:${port}\n`);
    if (mailer) startOrderEmailWorker(mailer);
  });
} catch (error) {
  console.error(
    error instanceof DatabaseConnectionError
      ? error.message
      : 'Could not start the API. Check the server environment settings and database access.',
  );
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
}
