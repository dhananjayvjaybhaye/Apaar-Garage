export function readSellerOptions(env = process.env) {
  const registration = env.GST_REGISTERED?.trim() || 'false';
  if (!['true', 'false'].includes(registration))
    throw new Error('Set GST_REGISTERED to true or false.');
  const gstRegistered = registration === 'true';
  const name = env.SELLER_NAME?.trim();
  const state = env.SELLER_STATE?.trim();
  const address = env.SELLER_ADDRESS?.trim();
  const gstin = env.SELLER_GSTIN?.trim().toUpperCase();
  if (gstRegistered && (!name || !state || !address || !gstin || !/^[0-9A-Z]{15}$/.test(gstin))) {
    throw new Error('Set SELLER_NAME, SELLER_ADDRESS, SELLER_STATE and a valid SELLER_GSTIN.');
  }
  return {
    name: name || 'Apaar Garage',
    state: state || 'Maharashtra',
    address,
    gstRegistered,
    ...(gstRegistered && { gstin }),
  };
}
