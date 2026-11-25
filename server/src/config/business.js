export const productStatuses = ['draft', 'published', 'hidden', 'archived'];
export const orderStatuses = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'undelivered',
  'returned_to_seller',
  'cancelled',
  'returned',
];
export const customerCancellable = ['placed', 'confirmed'];
export const adminCancellable = [...customerCancellable, 'packed'];
export const orderTransitions = {
  placed: ['confirmed'],
  confirmed: ['packed'],
  packed: ['shipped'],
  shipped: ['delivered', 'undelivered'],
  undelivered: ['returned_to_seller'],
};
export const undeliveredReasons = ['refused', 'unreachable', 'failed_attempts'];
export const stockConditions = ['resalable', 'damaged'];
export const confirmationStatuses = ['pending', 'confirmed', 'unreachable', 'declined'];
export const returnReasons = [
  'damaged',
  'wrong_item',
  'defective',
  'not_as_described',
  'changed_mind',
];
export const returnStatuses = [
  'requested',
  'approved',
  'rejected',
  'received',
  'refunded',
  'replaced',
];
export const stockReasons = ['sale', 'cancel', 'return', 'rto', 'adjustment', 'opening', 'import'];
export const certificationAge = 14; // Minimum age in years below which toys require BIS.
export const defaultReturnDays = 7; // Used for new products and older order lines without a snapshot.
export const maximumAgeGrade = 99; // Years.
export const financialYearStartMonth = 4; // April, in India Standard Time.
export const invoiceSequenceWidth = 6;
export const invoicePrefix = 'AG';
export const basisPointsPerPercent = 100;
export const basisPointsPerWhole = 10_000;
export const millisecondsPerDay = 86_400_000;
export const maximumOrderNoteLength = 500;
