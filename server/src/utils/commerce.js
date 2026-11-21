// Cart quantities and the conversion between public rupees and persisted paise.
export const maxCartQuantity = 99;
export const paisePerRupee = 100;

export function toPaise(rupees) {
  return Math.round(rupees * paisePerRupee);
}
