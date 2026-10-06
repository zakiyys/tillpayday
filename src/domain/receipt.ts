/**
 * Share of a receipt that belongs to the user. The model only reads the lines; this is where the numbers are made.
 * Tax, service and discount follow the user's share of the subtotal, rounded half up to the minor unit.
 * Shares of several people can differ from the printed tax by a unit or two; the user's own line is what is saved.
 */
export interface ReceiptLine { name: string; price: bigint; mine: boolean }
export interface ReceiptExtras { subtotal?: bigint | null; tax?: bigint; service?: bigint; discount?: bigint }

const roundDiv = (n: bigint, d: bigint) => (2n * n + d) / (2n * d);

export function receiptShare(lines: ReceiptLine[], extras: ReceiptExtras = {}) {
  // Nothing marked as the user's own means the whole receipt is theirs.
  const anyMine = lines.some((l) => l.mine);
  const picked = lines.filter((l) => !anyMine || l.mine);
  const skipped = lines.filter((l) => anyMine && !l.mine);
  const sum = (ls: ReceiptLine[]) => ls.reduce((t, l) => t + l.price, 0n);
  const mineSum = sum(picked);
  // A printed subtotal that is smaller than the user's own lines is a misread; fall back to the lines.
  const base = extras.subtotal && extras.subtotal >= mineSum ? extras.subtotal : sum(lines);
  const part = (x: bigint | undefined) => (x && x > 0n && base > 0n ? roundDiv(x * mineSum, base) : 0n);
  const tax = part(extras.tax);
  const service = part(extras.service);
  const discount = part(extras.discount);
  const raw = mineSum + tax + service - discount;
  return { picked, skipped, items: mineSum, tax, service, discount, total: raw > 0n ? raw : 0n };
}
