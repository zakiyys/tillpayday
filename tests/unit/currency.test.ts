import { describe, expect, it } from "vitest";
import { money } from "@/lib/format";
import { currencyLabel, currencySymbol, registerSymbols } from "@/lib/currency";

describe("amounts carry the currency symbol", () => {
  it("uses symbols, with a space only after letter symbols", () => {
    expect(money(25000n, "IDR", "id-ID")).toBe("Rp 25.000");
    expect(money(-25000n, "IDR", "id-ID")).toBe("−Rp 25.000");
    expect(money(25000n, "IDR", "id-ID", { sign: true })).toBe("+Rp 25.000");
    expect(money(123450n, "USD", "en-US")).toBe("$1,234.50");
    expect(money(123450n, "SGD", "id-ID")).toBe("S$1.234,50");
    expect(money(123450n, "MYR", "id-ID")).toBe("RM 1.234,50");
    expect(money(10000n, "JPY", "id-ID")).toBe("¥10.000");
  });
  it("tells dollar currencies apart and falls back to the code", () => {
    expect(new Set(["USD", "SGD", "AUD"].map(currencySymbol)).size).toBe(3);
    expect(money(5000n, "XYZ", "id-ID", { exp: 2 })).toBe("XYZ 50,00");
  });
  it("takes symbols from the database, but not one that just repeats the code", () => {
    registerSymbols([{ code: "XYZ", symbol: "Ж" }, { code: "SAR", symbol: "SAR" }]);
    expect(currencySymbol("XYZ")).toBe("Ж");
    expect(currencySymbol("SAR")).toBe("SR");
    expect(currencyLabel("IDR")).toBe("IDR · Rp");
    registerSymbols([{ code: "XYZ", symbol: "" }]);
  });
});
