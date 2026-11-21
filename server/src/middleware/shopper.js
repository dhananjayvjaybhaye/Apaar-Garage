import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { CartItem } from '../models/cart-item.js';
import { Product } from '../models/product.js';
import { maxCartQuantity } from '../utils/commerce.js';

const cookie = 'apaar_guest';
const audience = 'apaar-garage-guest';
const expiresIn = 30 * 86400;

export function createShopper(session, secret, secure) {
  return async (req, res, next) => {
    const user = await session.findUser(req);
    let guestId;
    if (req.cookies[cookie]) {
      try {
        const token = jwt.verify(req.cookies[cookie], secret, { algorithms: ['HS256'], audience });
        if (mongoose.isObjectIdOrHexString(token.sub))
          guestId = new mongoose.Types.ObjectId(token.sub);
      } catch {
        guestId = undefined;
      }
    }
    if (user) {
      if (guestId && (await CartItem.exists({ user: guestId }))) {
        await mergeCart(user._id, guestId);
      }
      res.locals.shopper = { id: user._id, guestId, user };
    } else {
      // Only a first add creates a guest session. Unauthenticated reads remain harmless.
      if (!guestId && req.method === 'POST' && req.baseUrl === '/cart') {
        guestId = new mongoose.Types.ObjectId();
        const token = jwt.sign({}, secret, {
          subject: guestId.toString(),
          algorithm: 'HS256',
          audience,
          expiresIn,
        });
        res.cookie(cookie, token, {
          httpOnly: true,
          secure,
          sameSite: 'lax',
          path: '/',
          maxAge: expiresIn * 1000,
        });
      }
      res.locals.shopper = { id: guestId, guestId, user: null };
    }
    next();
  };
}

async function mergeCart(user, guest) {
  await mongoose.connection.transaction(async (session) => {
    const lines = await CartItem.find({ user: guest }).session(session).lean();
    if (!lines.length) return;
    const products = await Product.find({ _id: { $in: lines.map((line) => line.product) } })
      .select('stock')
      .session(session)
      .lean();
    const stocks = new Map(products.map((product) => [product._id.toString(), product.stock]));

    for (const line of lines) {
      const filter = { user, product: line.product };
      const old = await CartItem.findOne(filter).session(session).lean();
      const room =
        Math.min(stocks.get(line.product.toString()) ?? 0, maxCartQuantity) - (old?.quantity ?? 0);
      const extra = Math.min(room, line.quantity);
      if (extra > 0)
        await CartItem.updateOne(filter, { $inc: { quantity: extra } }, { session, upsert: true });
    }

    await CartItem.deleteMany(
      { user: guest, _id: { $in: lines.map((line) => line._id) } },
      { session },
    );
  });
}
