// Returns the delivery estimate and COD availability for a validated pincode.
import { deliveryFor, pincode } from '../services/delivery.js';
import { validate } from '../utils/http-error.js';

export function deliveryHandler(options) {
  return (req, res) => res.json(deliveryFor(options, validate(pincode, req.query.pincode)));
}
