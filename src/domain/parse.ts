import { type ISODate, addDays, parts, weekday, ymd } from "./dates";

/**
 * Local parser (SPEC 7.1 step 2, 7.2). Splits simple entries without a model: amount, date, account alias,
 * currency, description. Returns `confident: false` when the sentence needs the model.
 */

export interface AmountHit {
  /** Major units as a plain decimal string. */
  major: string;
  /** How it was read, shown on the confirmation card ("150 → 150.000"). */
  interpretedThousands: boolean;
  raw: string;
}

const SUFFIX: Record<string, number> = { k: 3, rb: 3, ribu: 3, jt: 6, juta: 6, m: 6, mio: 6 };

/**
 * Reads one amount token: "25k", "25rb", "2,3jt", "1.5 juta", "1.250.000", "12,50", "150" (as 150.000 when
 * `plainThousands` and the number is under 1000).
 */
export function parseAmountToken(raw: string, opts: { decimalComma: boolean; plainThousands: boolean }): AmountHit | null {
  const m = /^(\d+(?:[.,]\d+)*)\s*(k|rb|ribu|jt|juta|m|mio)?$/i.exec(raw.trim());
  if (!m) return null;
  let num = m[1]!;
  const suffix = m[2]?.toLowerCase();
  const thousandsSep = opts.decimalComma ? "." : ",";
  const decimalSep = opts.decimalComma ? "," : ".";
  if (suffix) {
    // With a suffix the last separator is a decimal point: "2,3jt", "1.5 juta", "1.250,5k".
    const last = Math.max(num.lastIndexOf("."), num.lastIndexOf(","));
    const i = last < 0 ? num : num.slice(0, last).replace(/[.,]/g, "");
    const f = last < 0 ? "" : num.slice(last + 1);
    const shift = SUFFIX[suffix]!;
    const digits = (i + f.padEnd(shift, "0").slice(0, shift)).replace(/^0+(?=\d)/, "");
    const rest = f.length > shift ? `.${f.slice(shift)}` : "";
    return { major: `${digits}${rest}`, interpretedThousands: false, raw };
  }
  const groups = num.split(thousandsSep);
  if (groups.length > 1 && groups.slice(1).every((g) => /^\d{3}(?:[.,]\d+)?$/.test(g))) num = groups.join("");
  else if (groups.length > 1) return null;
  num = num.replace(decimalSep, ".");
  if ((num.match(/\./g) ?? []).length > 1) return null;
  if (opts.plainThousands && !num.includes(".") && Number(num) > 0 && Number(num) < 1000) return { major: `${num}000`, interpretedThousands: true, raw };
  return { major: num, interpretedThousands: false, raw };
}

const DAY_NAMES: Record<string, number> = {
  minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Relative dates (SPEC 7.2): kemarin, 2 hari lalu, Jumat lalu, tanggal 28. Returns the date and the matched text. */
export function parseDate(text: string, today: ISODate): { date: ISODate; match: string } | null {
  const t = text.toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /\b(kemarin lusa|lusa kemarin)\b/.exec(t))) return { date: addDays(today, -2), match: m[0] };
  if ((m = /\b(kemarin|yesterday)\b/.exec(t))) return { date: addDays(today, -1), match: m[0] };
  if ((m = /\b(hari ini|tadi(?: pagi| siang| sore| malam)?|today)\b/.exec(t))) return { date: today, match: m[0] };
  if ((m = /\b(\d{1,2})\s*(hari|hr|days?)\s*(lalu|yang lalu|yg lalu|ago)\b/.exec(t))) return { date: addDays(today, -Number(m[1])), match: m[0] };
  if ((m = /\b(seminggu|minggu) (lalu|kemarin)\b|\b(a )?week ago\b/.exec(t))) return { date: addDays(today, -7), match: m[0] };
  if ((m = /\b(minggu|senin|selasa|rabu|kamis|jum'?at|sabtu|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*(lalu|kemarin|last)?\b/.exec(t))) {
    // "minggu" alone is ambiguous (Sunday or week); only accept it with "lalu".
    if (m[1] === "minggu" && !m[2]) return null;
    const wd = DAY_NAMES[m[1]!.replace("'", "")] ?? DAY_NAMES[m[1]!];
    if (wd === undefined) return null;
    let back = (weekday(today) - wd + 7) % 7;
    if (back === 0) back = 7;
    return { date: addDays(today, -back), match: m[0] };
  }
  if ((m = /\b(?:tanggal|tgl|tg|date)\s*(\d{1,2})\b/.exec(t))) {
    const p = parts(today);
    const day = Number(m[1]);
    let d = ymd(p.year, p.month, day);
    if (d > today) d = ymd(p.year, p.month - 1, day);
    return { date: d, match: m[0] };
  }
  return null;
}

export const CURRENCY_WORDS: Record<string, string> = {
  yen: "JPY", jpy: "JPY", "¥": "JPY",
  usd: "USD", dollar: "USD", dolar: "USD", "$": "USD",
  sgd: "SGD", eur: "EUR", euro: "EUR", "€": "EUR", myr: "MYR", ringgit: "MYR", aud: "AUD", gbp: "GBP", pound: "GBP",
  sar: "SAR", riyal: "SAR", thb: "THB", baht: "THB", won: "KRW", krw: "KRW",
};

export interface AliasTarget {
  id: string;
  names: string[];
  institution?: string | null;
  last4?: string | null;
  isDefault?: boolean;
}

/**
 * Account by alias, name, last 4 digits or institution (SPEC 7.5). Naming only the institution picks its default
 * account; several accounts at an institution without a default stays unresolved (the app asks).
 */
export function matchAccount(text: string, accounts: AliasTarget[]): { id: string | null; match: string; ambiguous: string[] } | null {
  const t = ` ${text.toLowerCase()} `;
  const word = (w: string) => new RegExp(`[\\s,.(]${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s,.)]`, "i");
  // Exact names and aliases first, longest first so "bank a tabungan" beats "bank a".
  const named = accounts.flatMap((a) => a.names.filter(Boolean).map((n) => ({ a, n: n.toLowerCase() }))).sort((x, y) => y.n.length - x.n.length);
  for (const { a, n } of named) if (word(n).test(t)) return { id: a.id, match: n, ambiguous: [] };
  for (const a of accounts) if (a.last4 && word(a.last4).test(t)) return { id: a.id, match: a.last4, ambiguous: [] };
  const insts = [...new Set(accounts.map((a) => a.institution?.toLowerCase()).filter(Boolean))] as string[];
  for (const inst of insts.sort((x, y) => y.length - x.length)) {
    if (!word(inst).test(t)) continue;
    const at = accounts.filter((a) => a.institution?.toLowerCase() === inst);
    const def = at.find((a) => a.isDefault) ?? (at.length === 1 ? at[0] : undefined);
    return { id: def?.id ?? null, match: inst, ambiguous: def ? [] : at.map((a) => a.id) };
  }
  return null;
}

export interface LocalEntry {
  kind: "INCOME" | "EXPENSE";
  description: string;
  amount: AmountHit;
  currency: string | null;
  accountId: string | null;
  accountAmbiguous: string[];
  date: ISODate;
  dateText: string | null;
}

const INCOME_WORDS = /\b(gaji|gajian|salary|payday|bonus|thr|pemasukan|income|terima|dapat|refund)\b/i;
const COMPLEX = /\b(trf|transfer|tf|kirim|pindah|top ?up|isi saldo|pinjam|pinjem|pinjamin|pinjemin|minjam|minjem|minjemin|ngutang|ngutangin|ngebon|hutang|utang|piutang|bayar hutang|patungan|split|bagi|beli saham|jual|saldo|harusnya|ganti|ubah|berapa|how much|habis berapa|simulasi|cicil|lot|gram)\b|\?/i;

/**
 * One or more simple entries separated by commas, "dan", "trus", "terus", "lalu", "and", "then".
 * Each piece needs an amount; anything with transfer, debt, asset, balance, correction or question words is left
 * to the model (confident = false).
 */
export function localParse(
  text: string,
  ctx: { today: ISODate; accounts: AliasTarget[]; decimalComma: boolean; plainThousands: boolean },
): { confident: boolean; entries: LocalEntry[] } {
  const clean = text.trim();
  if (!clean || clean.length > 300 || COMPLEX.test(clean)) return { confident: false, entries: [] };
  // A comma between digits is a decimal ("1,5jt"), and "lalu" after a day word is part of a date ("jumat lalu").
  const pieces = clean
    .replace(/(\d)\s*[.,]-(?=\s|$)/g, "$1")
    .split(/\s*(?:(?<!\d),|,(?!\d)|;|\n|\b(?:dan|trus|terus|and|then|plus)\b|(?<!\b(?:hari|hr|days?|minggu|senin|selasa|rabu|kamis|jum'?at|sabtu|yang|yg)\s+)\blalu\b)\s*/i)
    .filter((p) => p.trim());
  const entries: LocalEntry[] = [];
  for (const piece of pieces) {
    let rest = ` ${piece} `;
    const d = parseDate(rest, ctx.today);
    if (d) rest = rest.replace(new RegExp(d.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
    let currency: string | null = null;
    for (const [w, code] of Object.entries(CURRENCY_WORDS)) {
      const re = new RegExp(`(^|\\s)${w.replace(/[$¥€]/g, "\\$&")}(?=\\s|\\d|$)`, "i");
      if (re.test(rest)) {
        currency = code;
        rest = rest.replace(re, " ");
        break;
      }
    }
    const acc = matchAccount(rest, ctx.accounts);
    if (acc) rest = rest.replace(new RegExp(`(^|\\s)${acc.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s,.]|$)`, "i"), " ");
    const amountRe = /(?:^|\s)(?:rp\.?\s*)?(\d+(?:[.,]\d+)*\s*(?:k|rb|ribu|jt|juta|m|mio)?)(?=\s|$)/gi;
    const hits = [...rest.matchAll(amountRe)];
    if (hits.length !== 1) return { confident: false, entries: [] };
    const amount = parseAmountToken(hits[0]![1]!, { decimalComma: ctx.decimalComma, plainThousands: ctx.plainThousands && !currency });
    if (!amount || amount.major === "0") return { confident: false, entries: [] };
    const description = rest.replace(hits[0]![0], " ").replace(/\b(pakai|pake|via|dari|dengan|from|with|using|di|at|cash)\b/gi, " ").replace(/\s+/g, " ").trim();
    if (!description) return { confident: false, entries: [] };
    entries.push({
      kind: INCOME_WORDS.test(piece) ? "INCOME" : "EXPENSE",
      description,
      amount,
      currency,
      accountId: acc?.id ?? null,
      accountAmbiguous: acc?.ambiguous ?? [],
      date: d?.date ?? ctx.today,
      dateText: d?.match ?? null,
    });
  }
  return { confident: entries.length > 0, entries };
}

/** Keyword hints for categories when no Rule matches. Keys are category keys from the seed. */
export const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/\b(kopi|coffee|makan|lunch|dinner|sarapan|breakfast|ramen|nasi|bakso|mie|resto|warung|cafe|kafe|snack|jajan|minum|teh|boba)\b/i, "food"],
  [/\b(belanja bulanan|sayur|pasar|supermarket|minimarket|groceries|beras|telur)\b/i, "groceries"],
  [/\b(bensin|bbm|pertalite|pertamax|solar|parkir|tol|ojek|ojol|grab|gojek|taksi|taxi|kereta|krl|mrt|bus|transport|fuel|parking)\b/i, "transport"],
  [/\b(listrik|pln|air|pdam|internet|wifi|pulsa|kuota|token|telepon|bpjs|iuran)\b/i, "bills"],
  [/\b(sewa|kos|kontrakan|rent)\b/i, "housing"],
  [/\b(obat|apotek|dokter|klinik|rumah sakit|pharmacy|doctor)\b/i, "health"],
  [/\b(baju|sepatu|tas|shopee|tokopedia|lazada|elektronik|gadget|clothes|shoes)\b/i, "shopping"],
  [/\b(nonton|bioskop|film|netflix|spotify|game|konser|movie|cinema)\b/i, "entertainment"],
  [/\b(admin|biaya bank|bunga|denda|fee)\b/i, "finance_fees"],
  [/\b(gaji|gajian|salary|thr)\b/i, "salary"],
];

export function hintCategory(description: string): string | null {
  for (const [re, key] of CATEGORY_HINTS) if (re.test(description)) return key;
  return null;
}
