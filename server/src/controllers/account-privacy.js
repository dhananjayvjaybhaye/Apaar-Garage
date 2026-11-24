import { z } from 'zod';
import { authenticate } from '../services/auth.js';
import { deleteAccount, exportAccount } from '../services/account-privacy.js';
import { validate } from '../utils/http-error.js';

const closure = z.strictObject({
  password: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value) <= 72),
  confirm: z.literal(true, 'Confirm that you want to close the account.'),
});

export function accountPrivacy(session, retentionDays) {
  return {
    async export(_req, res) {
      res.attachment('apaar-garage-account.json');
      res.json(await exportAccount(res.locals.user._id));
    },
    async close(req, res) {
      const { password } = validate(closure, req.body);
      const user = res.locals.user;
      await authenticate({ email: user.email, password });
      await deleteAccount(user._id, retentionDays);
      session.clear(res);
      res.sendStatus(204);
    },
  };
}
