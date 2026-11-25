import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse/sync';
import { maxCellLength, maxRows, notesMarker, isNotesRow } from '../config/product-import.js';
import { HttpError } from './http-error.js';
import { columns, columnNote, flattenProduct } from './product-sheet-columns.js';
import { readWorkbook, workbookStream } from './product-workbook.js';

const formulaPrefix = /^\s*[=+\-@]|^[\t\r\n]/;
const utf8 = new TextDecoder('utf-8', { fatal: true });

function encodeCell(value) {
  if (value == null) return '';
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

function csvCell(value) {
  const text = String(value ?? '');
  const escaped =
    typeof value === 'string' && (formulaPrefix.test(text) || /^'/.test(text)) ? "'" + text : text;
  return '"' + escaped.replaceAll('"', '""') + '"';
}

function readCsv(buffer) {
  try {
    const decoded = utf8.decode(buffer);
    if (decoded.includes('\0')) throw new Error('Binary data.');
    const records = parse(decoded, {
      info: true,
      max_record_size: maxCellLength * 2,
      relax_column_count: true,
      skip_empty_lines: true,
      to: maxRows + 3,
    });
    return records.map(({ record, info }) => ({
      number: info.lines,
      cells: record.map((cell) =>
        cell.startsWith("'") && (/^''/.test(cell) || formulaPrefix.test(cell.slice(1)))
          ? cell.slice(1)
          : cell,
      ),
    }));
  } catch {
    throw new HttpError(400, 'Use a valid UTF-8 CSV with quoted cells where needed.');
  }
}

export async function parseProductSheet(file) {
  const extension = extname(file.name).toLowerCase();
  const records =
    extension === '.csv'
      ? readCsv(file.bytes)
      : extension === '.xlsx'
        ? await readWorkbook(file.bytes)
        : null;
  if (!records) throw new HttpError(415, 'Choose a CSV or XLSX file.');
  const headers = Array.from(records.shift()?.cells ?? [], (value) => String(value ?? '').trim());
  if (
    headers.length === 0 ||
    headers.some((key) => !columns.includes(key)) ||
    new Set(headers).size !== headers.length
  )
    throw new HttpError(400, 'Use recognized product columns with unique header names.');
  if (isNotesRow(records[0]?.cells[0])) records.shift();
  if (records.length > maxRows)
    throw new HttpError(413, 'The spreadsheet contains more than 500 product rows.');
  return records
    .filter(({ cells }) => cells.some((value) => String(value ?? '').trim()))
    .map(({ number, cells }) => {
      const data = cells.flatMap((value, index) =>
        headers[index] && String(value ?? '').trim() ? [[headers[index], value]] : [],
      );
      const errors = cells.slice(headers.length).some((value) => String(value ?? '').trim())
        ? [{ field: 'row', message: 'This row has cells without a column header.' }]
        : [];
      return { number, data: Object.fromEntries(data), errors };
    });
}

export function sheetStream(format, records) {
  if (format === 'xlsx') return workbookStream(records);
  return Readable.from(
    (async function* () {
      yield '\uFEFF';
      for await (const cells of records) yield cells.map(csvCell).join(',') + '\r\n';
    })(),
  );
}

export async function* productRecords(products, includeCost) {
  const fields = columns.filter((key) => key !== 'costPrice' || includeCost);
  yield fields;
  yield fields.map((key, index) =>
    index === 0 ? notesMarker + ': ' + columnNote(key) : columnNote(key),
  );
  for await (const product of products) {
    const flat = flattenProduct(product);
    yield fields.map((key) => encodeCell(flat[key]));
  }
}

export function parsePrefill(file) {
  if (extname(file.name).toLowerCase() !== '.json') return parseProductSheet(file);
  try {
    const data = JSON.parse(utf8.decode(file.bytes));
    if (!data || Array.isArray(data) || typeof data !== 'object')
      throw new Error('Expected one object.');
    return [{ number: 1, data: flattenProduct(data), errors: [] }];
  } catch {
    throw new HttpError(400, 'Use a JSON file containing one product object.');
  }
}
