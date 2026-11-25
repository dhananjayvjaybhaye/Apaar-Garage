import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { metadataTags, pageMetadata, structuredData } from '../src/app/seo/metadata.mjs';

const publicFile = (path) => new URL('../public' + path, import.meta.url);
const iconFiles = [
  '/logo/favicon.ico',
  '/logo/favicon.svg',
  '/logo/apple-touch-icon.png',
  '/logo/icon-192.png',
  '/logo/icon-512.png',
  '/logo/icon-maskable-512.png',
  '/logo/organization.png',
];

test('brand images stay below their production byte budgets', async () => {
  const budgets = [
    ...['header.webp', 'header@2x.webp', 'header.png', 'header@2x.png'].map((name) => [
      '/logo/' + name,
      40_000,
    ]),
    ...iconFiles.map((name) => [name, 20_000]),
    ['/logo/share.jpg', 200_000],
  ];
  await Promise.all(budgets.map(async ([name, limit]) => {
    const { size } = await stat(publicFile(name));
    assert.ok(size < limit, `${name} is ${size} bytes (limit ${limit})`);
  }));

  const favicon = await readFile(publicFile('/logo/favicon.ico'));
  assert.equal(favicon.readUInt16LE(2), 1);
  assert.equal(favicon.readUInt16LE(4), 3);
  assert.deepEqual([6, 22, 38].map((offset) => [favicon[offset], favicon[offset + 1]]), [
    [16, 16], [32, 32], [48, 48],
  ]);
});

test('the index and home metadata point to the public brand assets', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html);
  const link = (selector) => window.document.querySelector(selector)?.getAttribute('href');
  assert.equal(link('link[rel="icon"][type="image/x-icon"]'), '/logo/favicon.ico');
  assert.equal(link('link[rel="icon"][type="image/svg+xml"]'), '/logo/favicon.svg');
  assert.equal(link('link[rel="apple-touch-icon"][sizes="180x180"]'), '/logo/apple-touch-icon.png');
  const manifestPath = link('link[rel="manifest"]');
  assert.equal(manifestPath, '/manifest.webmanifest');
  const manifest = JSON.parse(await readFile(publicFile(manifestPath), 'utf8'));
  assert.equal(manifest.name, 'Apaar Garage');
  assert.equal(manifest.short_name, 'Apaar Garage');
  assert.equal(manifest.theme_color, '#0b0d10');
  assert.equal(manifest.background_color, '#0b0d10');
  assert.deepEqual(manifest.icons.map(({ src, sizes, purpose }) => [src, sizes, purpose]), [
    ['/logo/icon-192.png', '192x192', 'any'],
    ['/logo/icon-512.png', '512x512', 'any'],
    ['/logo/icon-maskable-512.png', '512x512', 'maskable'],
  ]);
  for (const { src, sizes } of manifest.icons) {
    const png = await readFile(publicFile(src));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, sizes);
  }

  const origin = 'https://shop.example';
  const home = pageMetadata('/', origin);
  const tags = metadataTags(home);
  assert.ok(tags.some(([type, name, url]) =>
    type === 'property' && name === 'og:image' && url === origin + '/logo/share.jpg'));
  assert.ok(tags.some(([type, name, url]) =>
    type === 'name' && name === 'twitter:image' && url === origin + '/logo/share.jpg'));
  const organization = JSON.parse(structuredData(home.graph))['@graph']
    .find((node) => node['@type'] === 'Organization');
  assert.equal(organization.logo, origin + '/logo/organization.png');
  const logo = await readFile(publicFile(new URL(organization.logo).pathname));
  assert.equal(logo.readUInt32BE(16), logo.readUInt32BE(20));
  assert.ok(logo.readUInt32BE(16) >= 112);
  window.close();
});
