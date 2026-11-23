// Check the built home page with Chrome and a seeded API. See the change guide.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH ?? 'playwright-core');
const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4200';
const widths = [360, 390, 768, 1024, 1440, 1920];
const categories = ['car', 'truck', 'bike', 'rc'];
const margin = 40;

function isCategoryRequest(url) {
  return (
    url.pathname === '/products' &&
    url.searchParams.get('sort') === 'featured' &&
    (categories.includes(url.searchParams.get('category')) ||
      url.searchParams.get('productType') === 'rc')
  );
}

async function openHome(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.categoryShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.categoryShifts.push(entry.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  return page;
}

async function checkBottom(page, id, selector, state) {
  const section = page.locator('#tour-' + id);
  const card = section.locator(selector).last();
  await card.waitFor({ timeout: 10000 });
  const bounds = await card.evaluate((node) => {
    const scene = node.closest('.category-scene');
    const next =
      scene.nextElementSibling ?? scene.closest('app-category-stages').nextElementSibling;
    const cardRect = node.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const nextRect = next?.getBoundingClientRect();
    const overflow = [];
    for (let container = node.parentElement; container; container = container.parentElement) {
      const { overflowX, overflowY } = getComputedStyle(container);
      overflow.push(overflowX, overflowY);
      if (container === scene) break;
    }
    return {
      space: sceneRect.bottom - cardRect.bottom,
      nextSpace: nextRect.top - cardRect.bottom,
      overflow,
    };
  });
  const label = page.viewportSize().width + 'px ' + id + ' ' + state;
  assert(bounds.space >= margin, label + ' bottom clearance ' + bounds.space);
  assert(
    bounds.nextSpace >= margin && (state === 'product' || bounds.nextSpace <= 100),
    label + ' gap to next section ' + bounds.nextSpace,
  );
  assert(
    bounds.overflow.every((value) => value === 'visible'),
    label + ' has a clipping ancestor',
  );
}

async function checkFilled(browser, width) {
  const page = await openHome(browser, width);
  try {
    await page.goto(base + '/');
    for (const id of categories) {
      const section = page.locator('#tour-' + id);
      await section.locator('app-product-card').first().waitFor({ timeout: 10000 });
      await checkBottom(page, id, 'app-product-card', 'product');
      await checkBottom(page, id, '.final-card', 'View all');
    }
    const seam = await page
      .locator('.category-scene')
      .first()
      .evaluate(
        (section) =>
          section.getBoundingClientRect().top -
          document.querySelector('.hero').getBoundingClientRect().bottom,
      );
    assert(Math.abs(seam) < 1, width + 'px has a gap or overlap between the hero and Cars');
    await page.evaluate(() => {
      window.categoryShifts = [];
    });
    for (const id of categories) {
      const lastCard = page.locator('#tour-' + id + ' .final-card a');
      const hit = await lastCard.evaluate(async (link) => {
        link.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const rect = link.getBoundingClientRect();
        return link.contains(
          document.elementFromPoint(rect.left + rect.width / 3, rect.bottom - 12),
        );
      });
      assert(hit, width + 'px ' + id + ' View all card is covered at its bottom');
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(overflow <= 0, width + 'px home has horizontal overflow');
    const shifts = await page.evaluate(() => window.categoryShifts);
    assert.deepEqual(shifts, [], width + 'px layout moved while traversing loaded categories');
  } finally {
    await page.close();
  }
}

async function checkLoadingAndEmpty(browser, width) {
  const page = await openHome(browser, width);
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  try {
    await page.route(isCategoryRequest, async (route) => {
      await pending;
      const limit = Number(new URL(route.request().url()).searchParams.get('limit'));
      await route.fulfill({ json: { items: [], total: 0, totalPages: 0, page: 1, limit } });
    });
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    for (const id of categories) await checkBottom(page, id, '.scene-skeleton:visible', 'loading');
    release();
    for (const id of categories) {
      await checkBottom(page, id, '.scene-empty', 'empty');
      const href = await page.locator('#tour-' + id + ' .scene-empty a').getAttribute('href');
      assert.equal(href, id === 'rc' ? '/catalog?productType=rc' : '/catalog?category=' + id);
    }
  } finally {
    release();
    await page.close();
  }
}

async function checkEntrance(browser) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  });
  try {
    await page.addInitScript(() => {
      sessionStorage.setItem('apaar-garage-entered', 'true');
      // Isolate category motion from WebGL initialization in the browser regression test.
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (context, ...args) {
        return context === 'webgl2' ? null : original.call(this, context, ...args);
      };
    });
    await page.goto(base + '/#tour-car');
    const product = page.locator('#tour-car .scene-card-motion').first();
    await product.waitFor({ timeout: 10000 });
    await page.waitForFunction(() =>
      Boolean(document.querySelector('#tour-car .scene-card-motion')?.style.transform),
    );
    await checkBottom(page, 'car', '.final-card', 'animated View all');
    console.log('1440px: the category card entrance still runs with motion enabled');
  } finally {
    await page.close();
  }
}

const rc = await fetch(base + '/products?productType=rc&sort=featured&limit=8');
assert(rc.ok, 'The preview must proxy /products to the local API.');
const page = await rc.json();
assert(page.total > 0 && page.items.length > 0, 'Seed the API with npm.cmd run seed from server.');
assert(page.items.every((item) => item.productType === 'rc' && item.category.startsWith('rc-')));
console.log('RC catalog:', page.total, 'products,', page.items.length, 'returned to the home page');

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: 'chrome' }),
});
try {
  for (const width of widths) {
    await checkFilled(browser, width);
    await checkLoadingAndEmpty(browser, width);
    console.log(width + 'px: products, View all, loading, empty, and transition spacing passed');
  }
  await checkEntrance(browser);
} finally {
  await browser.close();
}
