import { Readable } from 'node:stream';
import { SaxesParser } from 'saxes';
import yazl from 'yazl';
import {
  isNotesRow,
  maxCellLength,
  maxRows,
  expandedZipMaxBytes,
} from '../config/product-import.js';
import { columns } from './product-sheet-columns.js';
import { checkedZip } from './checked-product-zip.js';
import { HttpError } from './http-error.js';

const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships';
const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const workbookParts = {
  '[Content_Types].xml':
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':
    '<Relationships xmlns="' +
    packageRel +
    '"><Relationship Id="rId1" Type="' +
    office +
    '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':
    '<workbook xmlns="' +
    sheetNs +
    '" xmlns:r="' +
    office +
    '"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<Relationships xmlns="' +
    packageRel +
    '"><Relationship Id="rId1" Type="' +
    office +
    '/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
};

function xmlText(value) {
  return (
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\r', '&#13;')
      // eslint-disable-next-line no-control-regex -- XML 1.0 forbids these characters.
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  );
}

function columnName(index) {
  let name = '';
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function writeRow(cells, row) {
  return (
    '<row r="' +
    row +
    '">' +
    cells
      .map((value, index) => {
        if (value == null || value === '') return '';
        const ref = columnName(index) + row;
        if (typeof value === 'number') return '<c r="' + ref + '"><v>' + value + '</v></c>';
        // Explicit string type ensures a formula-like value stays literal.
        return (
          '<c r="' +
          ref +
          '" t="inlineStr"><is><t xml:space="preserve">' +
          xmlText(value) +
          '</t></is></c>'
        );
      })
      .join('') +
    '</row>'
  );
}

export function workbookStream(records) {
  const zip = new yazl.ZipFile();
  for (const [path, part] of Object.entries(workbookParts))
    zip.addBuffer(Buffer.from(xmlHeader + part), path);
  zip.addReadStreamLazy('xl/worksheets/sheet1.xml', (done) => {
    done(
      null,
      Readable.from(
        (async function* () {
          yield xmlHeader + '<worksheet xmlns="' + sheetNs + '"><sheetData>';
          let row = 0;
          for await (const record of records) yield writeRow(record, ++row);
          yield '</sheetData></worksheet>';
        })(),
      ),
    );
  });
  zip.on('error', (error) => zip.outputStream.destroy(error));
  zip.end();
  return zip.outputStream;
}

function xmlParser(buffer, listeners) {
  const parser = new SaxesParser({ xmlns: true });
  parser.on('doctype', () => {
    throw new Error('Unsupported document type.');
  });
  for (const [event, handler] of Object.entries(listeners)) parser.on(event, handler);
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  parser.write(utf8.decode(buffer)).close();
}

function readStrings(buffer) {
  const strings = [];
  if (!buffer) return strings;
  let current;
  let reading = false;
  xmlParser(buffer, {
    opentag(tag) {
      if (tag.local === 'si') current = '';
      if (tag.local === 't') reading = true;
    },
    text(value) {
      if (reading && current !== undefined) {
        current += value;
        if (current.length > maxCellLength)
          throw new HttpError(413, 'A workbook cell is too long.');
      }
    },
    closetag(tag) {
      if (tag.local === 't') reading = false;
      if (tag.local === 'si') {
        strings.push(current ?? '');
        if (strings.length > columns.length * (maxRows + 2))
          throw new HttpError(413, 'The workbook contains too many cells.');
        current = undefined;
      }
    },
  });
  return strings;
}

function cellValue(cell, strings) {
  if (cell.formula !== undefined) return '=' + cell.formula;
  if (cell.type === 's') {
    const index = Number(cell.text);
    if (!/^\d+$/.test(cell.text) || strings[index] === undefined)
      throw new Error('Invalid shared string.');
    return strings[index];
  }
  if (cell.type === 'b') return cell.text === '1' ? 'true' : 'false';
  return cell.text;
}

function columnIndex(ref) {
  const letters = /^([A-Z]{1,3})[1-9]\d*$/.exec(ref ?? '')?.[1];
  if (!letters) throw new Error('Invalid cell reference.');
  return [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function readRows(buffer, strings) {
  const records = [];
  let row, cell, part;
  let seenNotes = false;
  let lastRow = 0;
  xmlParser(buffer, {
    opentag(tag) {
      if (['oleObject', 'oleObjects', 'controls', 'drawing', 'legacyDrawing'].includes(tag.local))
        throw new Error('Unsupported embedded workbook content.');
      if (tag.local === 'row') {
        const number = tag.attributes.r ? Number(tag.attributes.r.value) : lastRow + 1;
        if (!Number.isSafeInteger(number) || number <= lastRow || number > 1_048_576)
          throw new Error('Invalid row number.');
        row = { number, cells: [] };
        lastRow = number;
      }
      if (tag.local === 'c' && row) {
        const index = columnIndex(tag.attributes.r?.value);
        if (index >= columns.length)
          throw new HttpError(400, 'The workbook contains extra columns.');
        cell = { index, type: tag.attributes.t?.value, text: '' };
      }
      if (cell && ['v', 't', 'f'].includes(tag.local)) {
        part = tag.local;
        if (part === 'f') cell.formula = '';
      }
    },
    text(value) {
      if (!cell || !part) return;
      const key = part === 'f' ? 'formula' : 'text';
      cell[key] += value;
      if (cell[key].length > maxCellLength)
        throw new HttpError(413, 'A workbook cell is too long.');
    },
    closetag(tag) {
      if (tag.local === part) part = undefined;
      if (tag.local === 'c' && cell) {
        if (Object.hasOwn(row.cells, cell.index)) throw new Error('Duplicate cell reference.');
        row.cells[cell.index] = cellValue(cell, strings);
        cell = undefined;
      }
      if (tag.local === 'row' && row) {
        if (row.cells.some((value) => String(value ?? '').trim())) {
          if (records.length === 1 && isNotesRow(row.cells[0])) seenNotes = true;
          records.push(row);
          if (records.length > maxRows + 1 + Number(seenNotes))
            throw new HttpError(413, 'The spreadsheet contains more than 500 product rows.');
        }
        row = undefined;
      }
    },
  });
  return records;
}

export async function readWorkbook(buffer) {
  const parts = await checkedZip(buffer, true, expandedZipMaxBytes);
  const sheets = [...parts.keys()].filter((name) => /^xl\/worksheets\//.test(name));
  if (sheets.length !== 1 || !parts.has('xl/workbook.xml') || !parts.has('[Content_Types].xml'))
    throw new HttpError(400, 'Use an XLSX workbook with one worksheet.');
  try {
    xmlParser(parts.get('[Content_Types].xml'), {
      opentag(tag) {
        const type = tag.attributes.ContentType?.value ?? '';
        if (/macroEnabled|vba|oleObject|activeX/i.test(type))
          throw new Error('Unsupported workbook.');
      },
    });
    for (const [path, bytes] of parts) {
      if (path.endsWith('.rels'))
        xmlParser(bytes, {
          opentag(tag) {
            const type = tag.attributes.Type?.value ?? '';
            if (
              tag.attributes.TargetMode?.value === 'External' ||
              /oleObject|vbaProject|activeX/i.test(type)
            )
              throw new Error('Unsupported workbook link.');
          },
        });
    }
    return readRows(parts.get(sheets[0]), readStrings(parts.get('xl/sharedStrings.xml')));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'The workbook contains invalid data, macros or embedded objects.');
  }
}
