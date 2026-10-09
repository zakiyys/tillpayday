import { describe, expect, it } from "vitest";
import { localParse, matchAccount, parseAmountToken, parseDate } from "@/domain/parse";

const id = { decimalComma: true, plainThousands: true };
const major = (s: string) => parseAmountToken(s, id)?.major;

describe("amount parser (SPEC 7.2)", () => {
  it("reads common suffixes and separators", () => {
    expect(major("25k")).toBe("25000");
    expect(major("25rb")).toBe("25000");
    expect(major("2,3jt")).toBe("2300000");
    expect(major("1.5 juta")).toBe("1500000");
    expect(major("1.250.000")).toBe("1250000");
    expect(major("12,50")).toBe("12.50");
    expect(major("38rb")).toBe("38000");
  });
  it("plain numbers under 1000 mean thousands, and say so", () => {
    expect(parseAmountToken("150", id)).toEqual({ major: "150000", interpretedThousands: true, raw: "150" });
    expect(parseAmountToken("150", { ...id, plainThousands: false })?.major).toBe("150");
    expect(major("1200")).toBe("1200");
  });
});

describe("relative dates", () => {
  const today = "2026-10-06"; // Tuesday
  it("handles kemarin, N hari lalu, weekday lalu and tanggal N", () => {
    expect(parseDate("kemarin", today)?.date).toBe("2026-10-05");
    expect(parseDate("2 hari lalu", today)?.date).toBe("2026-10-04");
    expect(parseDate("jumat lalu", today)?.date).toBe("2026-10-02");
    expect(parseDate("tanggal 28", today)?.date).toBe("2026-09-28");
    expect(parseDate("tanggal 3", today)?.date).toBe("2026-10-03");
    expect(parseDate("kopi", today)).toBeNull();
  });
});

const accounts = [
  { id: "gp", names: ["GoPay Contoh", "gopay"], institution: "GoPay" },
  { id: "bca1", names: ["Bank A utama"], institution: "bca", last4: "1111", isDefault: true },
  { id: "bca2", names: ["Bank A tabungan"], institution: "bca", last4: "2222" },
  { id: "bca3", names: ["Bank A bisnis"], institution: "bca", last4: "3333" },
];

describe("account matching (scenario 20)", () => {
  it("institution name picks the default account of that institution", () => {
    expect(matchAccount("makan siang 38rb bca", accounts)).toMatchObject({ id: "bca1", match: "bca" });
    expect(matchAccount("kopi 2222", accounts)?.id).toBe("bca2");
    expect(matchAccount("Bank A tabungan", accounts)?.id).toBe("bca2");
  });
  it("without a default the match is ambiguous", () => {
    const noDefault = accounts.map((a) => ({ ...a, isDefault: false }));
    expect(matchAccount("pakai bca", noDefault)).toMatchObject({ id: null, ambiguous: ["bca1", "bca2", "bca3"] });
  });
});

describe("local parser (scenario 16)", () => {
  const ctx = { today: "2026-10-06", accounts, ...id };
  it("parses simple entries without a model", () => {
    const r = localParse("kopi 25k gopay", ctx);
    expect(r.confident).toBe(true);
    expect(r.entries).toMatchObject([{ kind: "EXPENSE", description: "kopi", amount: { major: "25000" }, accountId: "gp" }]);
  });
  it("splits two entries in one sentence", () => {
    const r = localParse("kopi 25k gopay, trus makan siang 38rb bca", ctx);
    expect(r.entries.map((e) => [e.description, e.amount.major, e.accountId])).toEqual([
      ["kopi", "25000", "gp"],
      ["makan siang", "38000", "bca1"],
    ]);
  });
  it("reads 'isi bensin 150' as 150.000 with no account", () => {
    const r = localParse("isi bensin 150", ctx);
    expect(r.entries[0]).toMatchObject({ amount: { major: "150000", interpretedThousands: true }, accountId: null });
  });
  it("salary is income", () => {
    expect(localParse("gajian masuk 15jt", ctx).entries[0]).toMatchObject({ kind: "INCOME", amount: { major: "15000000" } });
  });
  it("foreign currency words switch currency and disable the thousands rule", () => {
    expect(localParse("ramen 1200 yen cash", ctx).entries[0]).toMatchObject({ currency: "JPY", amount: { major: "1200", interpretedThousands: false } });
  });
  it("hands complex sentences to the model", () => {
    for (const s of ["trf ke budi 2 hari lalu dari bca 100rb", "beli saham ABCD 2 lot di 9000", "saldo gopay sekarang 85rb", "bulan ini makan habis berapa", "makan 300rb bca, patungan bertiga", "yang kopi tadi harusnya 35rb"]) {
      expect(localParse(s, ctx).confident, s).toBe(false);
    }
  });
});

describe("local parser on everyday phrasing", () => {
  const ctx = { today: "2026-10-09", accounts: [{ id: "gopay", names: ["gopay"] }], decimalComma: true, plainThousands: true };
  const one = (s: string) => {
    const r = localParse(s, ctx);
    return r.confident ? r.entries.map((e) => ({ d: e.description, a: e.amount.major, on: e.date })) : null;
  };
  it("keeps a decimal comma inside an amount", () => {
    expect(one("makan 1,5jt")).toEqual([{ d: "makan", a: "1500000", on: "2026-10-09" }]);
    expect(one("nasi goreng 25k, es teh 5k")).toHaveLength(2);
  });
  it("reads 'lalu' after a day word as part of the date, elsewhere as 'then'", () => {
    expect(one("jumat lalu nonton 50k")).toEqual([{ d: "nonton", a: "50000", on: "2026-10-02" }]);
    expect(one("3 hari lalu bakso 20k")).toEqual([{ d: "bakso", a: "20000", on: "2026-10-06" }]);
    expect(one("kopi 20k lalu roti 10k")).toHaveLength(2);
  });
  it("accepts the ',-' suffix and 'tadi pagi'", () => {
    expect(one("kopi 25.000,-")).toEqual([{ d: "kopi", a: "25000", on: "2026-10-09" }]);
    expect(one("tadi pagi kopi 20k")).toEqual([{ d: "kopi", a: "20000", on: "2026-10-09" }]);
  });
  it("leaves a top-up to the model or the form: it is a transfer, not spending", () => {
    expect(one("topup gopay 100k")).toBeNull();
    expect(one("top up gopay 100k")).toBeNull();
  });
});
