import { Router } from 'express';
import { createAuthController } from '../controllers/auth.js';
import { noStore, requestLimit } from '../middleware/http.js';

export function createAuthRouter(session) {
  const router = Router();
  const auth = createAuthController(session);
  const limitAuth = requestLimit({
    limit: 20,
    message: 'Too many sign-in or registration attempts. Try again later.',
  });
  router.use(noStore);
  router.post('/register', limitAuth, auth.register);
  router.post('/login', limitAuth, auth.login);
  router.get('/me', auth.me);
  router.post('/logout', auth.logout);
  return router;
}
