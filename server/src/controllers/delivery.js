// Returns the delivery estimate and COD availability for a validated pincode.
import { deliveryFor, pincode } from '../services/delivery.js';
import { commerceOptions } from '../services/store-settings.js';
import { validate } from '../utils/http-error.js';

export function deliveryHandler(options) {
  return async (req, res) =>
    res.json(deliveryFor(await commerceOptions(options), validate(pincode, req.query.pincode)));
}
