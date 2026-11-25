import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import axe from 'axe-core';
import { makeAdmin, startStore } from '../../server/test/store-fixture.js';
import { eventually, openFormBrowser } from './form-browser.mjs';

const editorUrl = '/admin/products/new';
const field = (id) => 'document.getElementById(' + JSON.stringify('product-' + id) + ')';
const click = (text) =>
  '[...document.querySelectorAll("button")].find(button => button.textContent.trim() === ' +
  JSON.stringify(text) +
  ').click()';
const write = (id, value, event = 'input') =>
  '(()=>{const element=' +
  field(id) +
  ';element.value=' +
  JSON.stringify(value) +
  ';element.dispatchEvent(new Event(' +
  JSON.stringify(event) +
  ',{bubbles:true}));})()';

function chooseFile(run, id, filename, content) {
  return run(`(() => {
    const input = document.getElementById(${JSON.stringify(id)});
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(filename)}));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function preview(t) {
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((done) => listener.close(done));
  const site = 'http://127.0.0.1:' + port;
  const api = await startStore(t, { CORS_ORIGINS: site });
  await makeAdmin(api);
  const child = spawn(process.execPath, ['scripts/preview.mjs'], {
    env: { ...process.env, PREVIEW_API: api, PREVIEW_PORT: String(port) },
    stdio: 'inherit',
    windowsHide: true,
  });
  t.after(() => child.kill());
  await eventually('production preview', () =>
    fetch(site)
      .then((r) => r.ok)
      .catch(() => false),
  );
  return site;
}

function measureLayout() {
  const errors = [];
  const forms = [...document.querySelectorAll('app-admin-product-fields .form-grid')];
  for (const grid of forms) {
    const fields = [...grid.querySelectorAll('app-form-field')];
    for (const item of fields) {
      const label = item.querySelector('label').getBoundingClientRect();
      const control = item.querySelector('.shared-field-control');
      const bounds = control.getBoundingClientRect();
      const message = item.querySelector('.shared-field-messages').getBoundingClientRect();
      if (label.bottom > bounds.top || bounds.bottom > message.top)
        errors.push(control.id + ' overlaps');
      if (bounds.left < -1 || bounds.right > innerWidth + 1) errors.push(control.id + ' overflows');
      for (const other of fields) {
        if (
          other === item ||
          Math.abs(other.getBoundingClientRect().top - item.getBoundingClientRect().top) > 1
        )
          continue;
        const peer = other.querySelector('.shared-field-control');
        const rect = peer.getBoundingClientRect();
        if (Math.abs(rect.top - bounds.top) > 1)
          errors.push(control.id + ' misaligned with ' + peer.id);
        if (
          control.tagName !== 'TEXTAREA' &&
          peer.tagName !== 'TEXTAREA' &&
          (Math.abs(rect.height - bounds.height) > 1 || bounds.height < 44)
        )
          errors.push(control.id + ' height differs from ' + peer.id);
      }
    }
  }
  return {
    errors: [...new Set(errors)],
    columns: getComputedStyle(forms[0]).gridTemplateColumns.split(' ').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
}

async function axeViolations(browser) {
  await browser.evaluate(axe.source);
  return browser.evaluate(`axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa'] }
  }).then(({ violations }) => violations.map(({ id, nodes }) =>
    ({ id, targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })))`);
}

test(
  'product form layout, accessibility, validation and admin titles',
  { timeout: 110_000 },
  async (t) => {
    const site = await preview(t);
    const browser = await openFormBrowser(t);
    const run = browser.evaluate;
    await browser.resize(1440, 900);
    await browser.navigate(site + '/admin/login');
    await eventually('admin login', () => run('!!document.getElementById("admin-email")'));
    assert.equal(await run('document.title'), 'Admin sign-in | Apaar Garage');
    await run(`document.getElementById("admin-email").value = "admin@example.test";
             document.getElementById("admin-password").value = "sample-password";
             document.querySelector("form button[type=submit]").click()`);
    await eventually('dashboard', () => run('!!document.querySelector("app-admin-dashboard")'));
    await browser.navigate(site + editorUrl);
    await eventually('create editor', () => run('!!document.querySelector(".editor-form")'));
    await eventually('create title', () =>
      run('document.title === "Create product | Apaar Garage Admin"'),
    );
    assert.deepEqual(await axeViolations(browser), [], 'axe violations before submit');
    await run(click('Save draft'));
    await eventually('draft error summary focused', () =>
      run('document.activeElement?.id === "product-save-error"'),
    );
    assert.equal(await run('document.querySelectorAll("[data-group-error]").length'), 0);
    assert.equal(await run(field('mrp') + '.getAttribute("aria-invalid")'), null);
    await run(write('productType', 'rc', 'change'));
    await run(write('ageGradeMin', '10'));
    await run(click('Publish'));
    await eventually('published groups', () =>
      run(
        'document.querySelectorAll("[data-group-error]").length === 2 && document.activeElement?.id === "product-save-error"',
      ),
    );
    assert.equal(await run('document.activeElement?.id'), 'product-save-error');
    assert.equal(await run('document.querySelectorAll("#product-group-bis").length'), 1);
    assert.equal(
      await run(field('bisLicenceNumber') + '.getAttribute("aria-describedby")'),
      'product-group-bis',
    );
    assert.equal(await run(field('manufacturerAddress') + '.getAttribute("aria-invalid")'), 'true');
    await run(
      `document.querySelector('#product-save-error a[href="#product-bisCertified"]').click()`,
    );
    assert.equal(await run('document.activeElement?.id'), 'product-bisCertified');
    for (const [width, height, columns] of [
      [1440, 900, 4],
      [1024, 768, 2],
      [768, 1024, 2],
      [390, 844, 1],
    ]) {
      await browser.resize(width, height);
      await eventually('layout at ' + width, () => run('innerWidth === ' + width));
      assert.deepEqual(
        await run('(' + measureLayout + ')()'),
        { errors: [], columns, overflow: false },
        width + 'px',
      );
    }
    assert.deepEqual(await axeViolations(browser), [], 'axe violations after invalid publish');

    await run(write('productType', 'diecast', 'change'));
    for (const [id, value] of Object.entries({
      name: 'Browser draft',
      slug: 'browser-form-draft',
      brand: 'Test brand',
      scale: '1:64',
      price: '500',
      description: 'A browser test listing',
      'image-url': '/images/share-garage.jpg',
    }))
      await run(write(id, value));
    await run(click('Add URL'));
    await run(click('Save draft'));
    await eventually('draft saved with incomplete compliance', () =>
      run('!!document.getElementById("product-save-success")'),
    );
    await run('document.querySelector("#product-save-success a").click()');
    await eventually('edit title', () =>
      run('document.title === "Edit product | Apaar Garage Admin"'),
    );
    await eventually('edit stock form', () => run('!!document.getElementById("stock-delta")'));
    await run(write('name', 'Edited and unsaved'));
    await run('window.confirm = () => false');
    await run(click('Cancel'));
    assert.equal(await run('location.pathname'), '/admin/products/browser-form-draft');
    await run('window.confirm = () => true');
    await run(click('Cancel'));
    await eventually('products after confirming', () =>
      run('document.title === "Products | Apaar Garage Admin"'),
    );

    await run('document.querySelector(\'a[href="/admin/product-import"]\').click()');
    await eventually('import page', () => run('!!document.getElementById("product-import-sheet")'));
    await chooseFile(
      run,
      'product-import-sheet',
      'draft.csv',
      'sku,slug,name,brand,productType,category,scale,price,description,images\n' +
        'BROWSER-IMPORT,browser-import,Browser import,Example,diecast,car,1:64,500,Test listing,/images/share-garage.jpg',
    );
    await run(click('Preview import'));
    await eventually('preview shown', () =>
      run('document.getElementById("import-preview-title")?.textContent === "Import preview"'),
    );
    assert.match(await run('document.querySelector(".import-table").textContent'), /create/);
    await run(click('Confirm draft import'));
    await eventually('import confirmed', () =>
      run('document.getElementById("import-preview-title")?.textContent === "Import result"'),
    );
    await run('document.querySelector(\'a[href="/admin/product-import/history"]\').click()');
    await eventually('import in history', () =>
      run('document.querySelector(".import-table")?.textContent.includes("draft.csv")'),
    );
    await browser.navigate(site + editorUrl);
    await eventually('new product form', () =>
      run('!!document.querySelector("app-product-prefill")'),
    );
    await run(click('Prefill from file'));
    await chooseFile(
      run,
      'product-prefill-file',
      'suggestion.json',
      '{"name":"Prefilled from file","price":0}',
    );
    await eventually('review prefilled fields', () =>
      run('document.body.textContent.includes("Fill form for review")'),
    );
    await run(click('Fill form for review'));
    assert.equal(await run(field('name') + '.value'), 'Prefilled from file');
    assert.equal(await run(field('price') + '.value'), '0');
    assert.equal(
      await run(field('name') + '.closest("app-form-field").classList.contains("prefilled-field")'),
      true,
    );
  },
);
