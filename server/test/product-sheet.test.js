import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProductSheet } from '../src/utils/product-sheet.js';
import { productSheetValues } from '../src/utils/product-sheet-values.js';
import { example, sheetFor, zipFiles } from './product-import-fixtures.js';

test('CSV and XLSX round-trip product types, fields, and literal spreadsheet text', async () => {
  const values = [
    example,
    {
      ...example,
      sku: 'RC-046',
      slug: 'round-trip-rc',
      productType: 'rc',
      category: 'rc-plane',
      runTime: 20,
      chargeTime: 65,
      topSpeed: 30,
      controlRange: 80,
      batteryIncluded: false,
      readyToRun: true,
      boxContents: ['Plane', 'Controller'],
      skillLevel: 'intermediate',
      recommendedAge: 14,
      warrantyDays: 30,
      name: '@plain',
      description: '-literal',
    },
  ];
  for (const format of ['csv', 'xlsx']) {
    const content = await sheetFor(values, format);
    const rows = await parseProductSheet({ name: 'export.' + format, bytes: content });
    assert.equal(rows.length, 2);
    for (const [index, row] of rows.entries()) {
      const normalized = productSheetValues(row);
      const { status: _status, ...writable } = values[index];
      assert.deepEqual(normalized.errors, []);
      assert.deepEqual(normalized.values, writable);
    }
    if (format === 'csv') assert.ok(content.toString().includes('"\'=this is listing text"'));
    const without = await sheetFor(values, format, false);
    const publicRows = await parseProductSheet({ name: 'export.' + format, bytes: without });
    assert.ok(publicRows.every(({ data }) => !Object.hasOwn(data, 'costPrice')));
  }
});

test('XLSX formula cells use the expression and ignore cached results', async () => {
  const files = [
    ['[Content_Types].xml', '<Types/>'],
    ['xl/workbook.xml', '<workbook/>'],
    [
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>description</t></is></c></row><row r="2"><c r="A2"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>',
    ],
  ];
  const archive = await zipFiles(files.map(([name, xml]) => [name, Buffer.from(xml)]));
  const [row] = await parseProductSheet({ name: 'formula.xlsx', bytes: archive });
  assert.equal(row.data.description, '=1+1');
});
