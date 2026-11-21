// Validates startup settings, connects MongoDB, and starts the API.
import { createApp } from './app.js';
import { connectDatabase } from './services/database.js';
import { createOrderMailer, startOrderEmailWorker } from './services/order-email.js';
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
  await Promise.all([User.init(), CartItem.init(), Order.init(), Review.init()]);

  app.listen(port, bindAddress, (error) => {
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    process.stdout.write(`Apaar Garage API listening at http://${bindAddress}:${port}\n`);
    if (mailer) startOrderEmailWorker(mailer);
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
