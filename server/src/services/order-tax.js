import { basisPointsPerPercent, basisPointsPerWhole } from '../config/business.js';

function roundedShare(amount, part, whole) {
  if (!whole) return 0;
  const denominator = BigInt(whole);
  return Number((BigInt(amount) * BigInt(part) + denominator / 2n) / denominator);
}

function allocateDiscount(items, subtotal, discount) {
  let gross = 0;
  let allocated = 0;
  return items.map((item) => {
    const lineGross = item.unitPricePaise * item.quantity;
    gross += lineGross;
    const throughLine = roundedShare(discount, gross, subtotal);
    const discountPaise = throughLine - allocated;
    allocated = throughLine;
    return { ...item, discountPaise, taxablePaise: lineGross - discountPaise, taxPaise: 0 };
  });
}

const normalizeState = (state) => state.trim().toLowerCase().replace(/\s+/g, ' ');

function applyRate(lines, gstRatePercent) {
  const denominator = basisPointsPerWhole + Math.round(gstRatePercent * basisPointsPerPercent);
  let payable = 0;
  let lineTaxableTotal = 0;
  for (const item of lines) {
    const net = item.taxablePaise;
    item.taxablePaise = roundedShare(net, basisPointsPerWhole, denominator);
    item.taxPaise = net - item.taxablePaise;
    payable += net;
    lineTaxableTotal += item.taxablePaise;
  }

  const taxable = roundedShare(payable, basisPointsPerWhole, denominator);
  let remainder = taxable - lineTaxableTotal;
  // The last line absorbs the remainder. Use preceding lines if its net amount is too small.
  for (let index = lines.length - 1; remainder && index >= 0; index--) {
    const item = lines[index];
    const correction = Math.min(item.taxPaise, Math.max(-item.taxablePaise, remainder));
    item.taxablePaise += correction;
    item.taxPaise -= correction;
    remainder -= correction;
  }
  return { taxable, tax: payable - taxable };
}

export function priceOrderTax(cart, seller, destinationState) {
  const items = allocateDiscount(cart.items, cart.subtotalPaise, cart.discountPaise);
  const taxBreakup = [];
  if (!seller.gstRegistered) return { items, taxBreakup };

  const groups = Map.groupBy(items, (item) => item.gstRatePercent);
  const inState = normalizeState(seller.state) === normalizeState(destinationState);
  for (const [gstRatePercent, lines] of groups) {
    const { taxable, tax } = applyRate(lines, gstRatePercent);
    const cgstPaise = inState ? Math.floor(tax / 2) : 0;
    taxBreakup.push({
      gstRatePercent,
      taxablePaise: taxable,
      cgstPaise,
      sgstPaise: inState ? tax - cgstPaise : 0,
      igstPaise: inState ? 0 : tax,
    });
  }
  return { items, taxBreakup };
}
