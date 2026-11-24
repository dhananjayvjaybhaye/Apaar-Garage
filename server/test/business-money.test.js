import assert from 'node:assert/strict';
import { test } from 'node:test';
import { financialYear } from '../src/services/invoices.js';
import { priceOrderTax } from '../src/services/order-tax.js';

test('the Indian invoice year changes at midnight IST on 1 April', () => {
  assert.equal(financialYear(new Date('2027-03-31T18:29:59.999Z')), '26-27');
  assert.equal(financialYear(new Date('2027-03-31T18:30:00.000Z')), '27-28');
});

test('discount and GST-inclusive taxable rounding reconcile in paise', () => {
  const items = [101, 201, 301].map((unitPricePaise) => ({
    unitPricePaise,
    gstRatePercent: 18,
    quantity: 1,
  }));
  const cart = { items, subtotalPaise: 603, discountPaise: 7 };
  const intra = priceOrderTax(cart, { gstRegistered: true, state: 'Maharashtra' }, ' maharashtra ');
  assert.deepEqual(
    intra.items.map(({ discountPaise }) => discountPaise),
    [1, 3, 3],
  );
  assert.deepEqual(
    intra.items.map(({ taxablePaise, taxPaise }) => [taxablePaise, taxPaise]),
    [
      [85, 15],
      [168, 30],
      [252, 46],
    ],
  );
  assert.deepEqual(intra.taxBreakup, [
    { gstRatePercent: 18, taxablePaise: 505, cgstPaise: 45, sgstPaise: 46, igstPaise: 0 },
  ]);
  const inter = priceOrderTax(cart, { gstRegistered: true, state: 'Maharashtra' }, 'Karnataka');
  assert.deepEqual(inter.taxBreakup, [
    { gstRatePercent: 18, taxablePaise: 505, cgstPaise: 0, sgstPaise: 0, igstPaise: 91 },
  ]);
  const unregistered = priceOrderTax(cart, { gstRegistered: false }, 'Karnataka');
  assert.deepEqual(unregistered.taxBreakup, []);
  assert.equal(
    unregistered.items.reduce((sum, item) => sum + item.taxablePaise, 0),
    596,
  );
  assert.ok(unregistered.items.every(({ taxPaise }) => taxPaise === 0));
});
