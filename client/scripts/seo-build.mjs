import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  metadataTags,
  pageMetadata,
  publicPages,
  seoCategories,
  siteOrigin,
  structuredData,
} from '../src/app/seo/metadata.mjs';

// Product requests are paginated to stay within the public catalog API's limits.
const pageSize = 100;
const output = fileURLToPath(new URL('../dist/apaar-garage/browser/', import.meta.url));
const slugFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const site = process.env.SITE_URL;
if (!site)
  throw new Error('Set SITE_URL to the public storefront origin before generating SEO files.');
const origin = siteOrigin(site);
const api = siteOrigin(process.env.SEO_CATALOG_API ?? 'http://127.0.0.1:3000');

const xml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

async function catalog() {
  const entries = new Map();
  let page = 1;
  let totalPages = 1;
  do {
    const url = new URL('/products', api);
    url.search = new URLSearchParams({ page, limit: pageSize, sort: 'name' }).toString();
    const response = await fetch(url);
    if (!response.ok)
      throw new Error('Catalog page ' + page + ' returned HTTP ' + response.status + '.');
    const result = await response.json();
    if (
      !Array.isArray(result.items) ||
      !Number.isSafeInteger(result.totalPages) ||
      result.totalPages < 0
    ) {
      throw new Error('Catalog returned invalid pagination.');
    }
    totalPages = result.totalPages;
    for (const item of result.items) {
      if (typeof item.slug !== 'string' || !slugFormat.test(item.slug) || item.slug.length > 150) {
        throw new Error('Catalog returned an invalid product slug.');
      }
      entries.set(item.slug, item);
    }
    page++;
  } while (page <= totalPages);
  return [...entries.values()];
}

function pageHead(info) {
  const tags = metadataTags(info).map(
    ([kind, key, content]) =>
      '<meta ' + kind + '="' + xml(key) + '" content="' + xml(content) + '">',
  );
  return [
    '<title>' + xml(info.title) + '</title>',
    '<meta name="storefront-origin" content="' + xml(origin) + '">',
    ...tags,
    '<link rel="canonical" href="' + xml(info.canonical) + '">',
    info.graph.length
      ? '<script id="store-structured-data" type="application/ld+json">' +
        structuredData(info.graph) +
        '</script>'
      : '',
  ].join('\n');
}

const products = await catalog();
const index = await readFile(join(output, 'index.html'), 'utf8');
const description = /<meta\b[^>]*\bname=["']description["'][^>]*>/i;
const generatedHead = /<!-- storefront-seo -->[\s\S]*?<!-- \/storefront-seo -->/;
const shell = index
  .replace(generatedHead, '')
  .replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(description, '');

const documentFor = (info) =>
  shell.replace(
    '</head>',
    () => '<!-- storefront-seo -->\n' + pageHead(info) + '\n<!-- /storefront-seo -->\n</head>',
  );

const pages = new Map(Object.keys(publicPages).map((path) => [path, pageMetadata(path, origin)]));
for (const product of products) {
  const path = '/product/' + product.slug;
  pages.set(path, pageMetadata(path, origin, product));
}
for (const [path, info] of pages) {
  const file = join(output, path.slice(1), 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, documentFor(info), 'utf8');
}

const catalogFilters = [
  ...Object.keys(seoCategories).map((category) => ['category', category]),
  ...['diecast', 'rc'].map((type) => ['productType', type]),
];
for (const [key, value] of catalogFilters) {
  const folder = join(output, '_seo', key, value);
  const path = '/catalog?' + key + '=' + value;
  const info = pageMetadata(path, origin);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'index.html'), documentFor(info), 'utf8');
  pages.set(path, info);
}

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...pages.values()]
    .map(({ canonical }) => '  <url><loc>' + xml(canonical) + '</loc></url>')
    .join('\n') +
  '\n</urlset>\n';
await writeFile(join(output, 'sitemap.xml'), sitemap, 'utf8');
const robots = (await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8')).trimEnd();
await writeFile(
  join(output, 'robots.txt'),
  robots + '\nSitemap: ' + new URL('/sitemap.xml', origin).href + '\n',
  'utf8',
);
process.stdout.write(
  'Generated metadata and sitemap entries for ' + pages.size + ' public URLs.\n',
);
