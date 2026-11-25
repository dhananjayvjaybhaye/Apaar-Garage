import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emailMessage } from '../src/services/order-email.js';
import { readOrderEmailOptions } from '../src/utils/config.js';

test('order emails use a public PNG, visible store name and escaped order data', () => {
  const order = {
    number: 'AG-123',
    emailAddress: 'buyer@example.test',
    totalPaise: 31400,
    deliveryEstimate: '3 < 7 days',
  };
  const env = {
    ORDER_EMAIL_ENABLED: 'true',
    ORDER_EMAIL_FROM: 'orders@example.test',
    ORDER_SMTP_USER: 'example',
    ORDER_SMTP_PASSWORD: 'example',
  };
  const { from, logoUrl } = readOrderEmailOptions({
    ...env,
    ORDER_EMAIL_SITE_URL: 'https://shop.example.test',
  });
  const message = emailMessage(order, 'placed', from, logoUrl);
  assert.match(message.html, /src="https:\/\/shop\.example\.test\/logo\/header\.png"[^>]*alt="Apaar Garage"/);
  assert.match(message.html, /<strong>Apaar Garage<\/strong>/);
  assert.match(message.html, /3 &lt; 7 days/);
  assert.match(message.text, /^Apaar Garage\n/);
  const fallback = emailMessage(order, 'placed', from, readOrderEmailOptions(env).logoUrl);
  assert.doesNotMatch(fallback.html, /<img/);
  assert.match(fallback.html, /<strong>Apaar Garage<\/strong>/);
});
