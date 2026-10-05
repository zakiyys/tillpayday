import { type ISODate, ymd } from "./dates";
import { parseAmountToken } from "./parse";

/** CSV with quoted fields (RFC 4180), delimiter auto-detected among , ; tab. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (q) {
      if (c === '"' && clean[i + 1] === '"') {
        f += '"';
        i++;
      } else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(f);
      if (row.some((x) => x.trim())) rows.push(row.map((x) => x.trim()));
      row = [];
      f = "";
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x.trim())) rows.push(row.map((x) => x.trim()));
  return rows;
}

/**
 * Column mapping stored per account (SPEC 8). Either one signed amount column, or separate debit/credit columns,
 * or an amount column plus a direction column (e.g. "DB"/"CR").
 */
export interface CsvMapping {
  date: number;
  description: number;
  amount?: number | null;
  debit?: number | null;
  credit?: number | null;
  direction?: number | null;
  balance?: number | null;
  dateFormat: "DMY" | "MDY" | "YMD";
  decimalComma: boolean;
  skipRows: number;
}

export function parseDateCell(s: string, fmt: CsvMapping["dateFormat"]): ISODate | null {
  const m = /(\d{1,4})[/.\-\s](\d{1,2}|[A-Za-z]{3,})[/.\-\s](\d{2,4})/.exec(s.trim());
  if (!m) return null;
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const ID = { mei: 5, agu: 8, agt: 8, okt: 10, des: 12 } as Record<string, number>;
  const mon = (x: string) => (/^\d+$/.test(x) ? Number(x) : (ID[x.slice(0, 3).toLowerCase()] ?? MONTHS.indexOf(x.slice(0, 3).toLowerCase()) + 1));
  let y: number, mo: number, d: number;
  if (fmt === "YMD" || m[1]!.length === 4) [y, mo, d] = [Number(m[1]), mon(m[2]!), Number(m[3])];
  else if (fmt === "MDY") [mo, d, y] = [mon(m[1]!), Number(m[2]), Number(m[3])];
  else [d, mo, y] = [Number(m[1]), mon(m[2]!), Number(m[3])];
  if (y < 100) y += 2000;
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  return ymd(y, mo, d);
}

/** Minor units from a statement cell ("1.250.000,00", "(50,000.00)", "-12.50", "1,250.00 DB"). */
export function parseMoneyCell(s: string, decimalComma: boolean, exp: number): bigint | null {
  let t = s.trim();
  if (!t) return null;
  let neg = /^\(.*\)$/.test(t) || /^-/.test(t) || /\b(DB|D|DR|DEBIT)\b\.?$/i.test(t);
  t = t.replace(/[()]/g, "").replace(/\b(DB|D|DR|CR|K|KR|DEBIT|CREDIT)\b\.?$/i, "").replace(/[^\d.,-]/g, "");
  if (t.startsWith("-")) {
    neg = true;
    t = t.slice(1);
  }
  if (!t) return null;
  const p = parseAmountToken(t, { decimalComma, plainThousands: false });
  if (!p) return null;
  const [i, f = ""] = p.major.split(".");
  if (f.length > exp && /[1-9]/.test(f.slice(exp))) return null;
  const v = BigInt(i! + f.padEnd(exp, "0").slice(0, exp));
  return neg ? -v : v;
}

export interface ParsedRow {
  idx: number;
  date: ISODate;
  description: string;
  amount: bigint;
  direction: "IN" | "OUT";
  balance: bigint | null;
}

export function applyMapping(rows: string[][], m: CsvMapping, exp: number): { rows: ParsedRow[]; errors: number[] } {
  const out: ParsedRow[] = [];
  const errors: number[] = [];
  rows.slice(m.skipRows).forEach((r, k) => {
    const idx = k + m.skipRows;
    const date = parseDateCell(r[m.date] ?? "", m.dateFormat);
    let signed: bigint | null = null;
    if (m.debit != null || m.credit != null) {
      const d = m.debit != null ? parseMoneyCell(r[m.debit] ?? "", m.decimalComma, exp) : null;
      const c = m.credit != null ? parseMoneyCell(r[m.credit] ?? "", m.decimalComma, exp) : null;
      if (d && d !== 0n) signed = -(d < 0n ? -d : d);
      else if (c && c !== 0n) signed = c < 0n ? -c : c;
    } else if (m.amount != null) {
      signed = parseMoneyCell(r[m.amount] ?? "", m.decimalComma, exp);
      if (signed != null && m.direction != null) {
        const dir = (r[m.direction] ?? "").trim().toUpperCase();
        const abs = signed < 0n ? -signed : signed;
        signed = /^(DB|D|DR|DEBIT|OUT|K)$/.test(dir) ? -abs : abs;
      }
    }
    if (!date || signed == null || signed === 0n) {
      errors.push(idx);
      return;
    }
    const balance = m.balance != null ? parseMoneyCell(r[m.balance] ?? "", m.decimalComma, exp) : null;
    out.push({ idx, date, description: (r[m.description] ?? "").slice(0, 200), amount: signed < 0n ? -signed : signed, direction: signed < 0n ? "OUT" : "IN", balance });
  });
  return { rows: out, errors };
}

/** Best-effort mapping guess from header names; the user confirms or changes it. */
export function guessMapping(rows: string[][]): CsvMapping {
  const head = (rows[0] ?? []).map((h) => h.toLowerCase());
  const find = (...names: string[]) => {
    const i = head.findIndex((h) => names.some((n) => h.includes(n)));
    return i < 0 ? null : i;
  };
  const sample = rows.slice(1, 6).flat().join(" ");
  const decimalComma = /\d\.\d{3},\d{2}\b/.test(sample) || (!/\d,\d{3}\.\d{2}\b/.test(sample) && /\d,\d{2}\b/.test(sample));
  return {
    date: find("tanggal", "date", "tgl") ?? 0,
    description: find("keterangan", "description", "uraian", "deskripsi", "remark", "detail") ?? 1,
    amount: find("jumlah", "amount", "nominal", "mutasi"),
    debit: find("debit", "debet", "keluar", "withdraw"),
    credit: find("kredit", "credit", "masuk", "deposit"),
    direction: find("db/cr", "d/k", "jenis", "type"),
    balance: find("saldo", "balance"),
    dateFormat: /\b\d{4}-\d{2}-\d{2}\b/.test(sample) ? "YMD" : "DMY",
    decimalComma,
    skipRows: head.some((h) => /[a-z]/.test(h)) ? 1 : 0,
  };
}

/** Account number in a statement header matched against last4 (SPEC 8: not by institution name). */
export function findAccountByNumber(text: string, accounts: Array<{ id: string; last4: string | null }>): string | null {
  const nums = [...text.matchAll(/\b\d[\d\s-]{5,22}\d\b/g)].map((m) => m[0].replace(/\D/g, ""));
  const hits = accounts.filter((a) => a.last4 && nums.some((n) => n.endsWith(a.last4!)));
  return hits.length === 1 ? hits[0]!.id : null;
}
