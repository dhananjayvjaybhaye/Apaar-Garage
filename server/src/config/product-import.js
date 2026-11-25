// Import limits are bytes unless a name specifies a row or file count.
const mib = 1024 ** 2;
export const sheetMaxBytes = 5 * mib;
export const imageZipMaxBytes = 20 * mib;
export const expandedZipMaxBytes = 40 * mib;
export const maxRows = 500;
export const maxArchiveEntries = 1000;
export const maxImportJobs = 2;
export const maxCellLength = 32_768;
export const previewLifetimeSeconds = 15 * 60;
export const historyPageSize = 25;
export const importModes = ['create', 'upsert'];
export const notesMarker = '# notes';
export const isNotesRow = (value) =>
  value === notesMarker || (typeof value === 'string' && value.startsWith(notesMarker + ': '));
