import { describe, expect, it } from "vitest";
import { findInstitution, INSTITUTIONS } from "@/lib/institutions";
import { GLYPHS } from "@/lib/brand-glyphs";

describe("institution marks", () => {
  it("finds the institution from the provider field first, then the account name", () => {
    expect(findInstitution("BCA", "Gaji")?.id).toBe("bca");
    expect(findInstitution(null, "BCA Tabungan")?.id).toBe("bca");
    expect(findInstitution("", "Kartu Kredit Mandiri")?.id).toBe("mandiri");
    expect(findInstitution(null, "gopay")?.id).toBe("gopay");
  });
  it("prefers the longer name and needs whole words", () => {
    expect(findInstitution("GoPay Later")?.id).toBe("gopaylater");
    expect(findInstitution("blu by BCA")?.id).toBe("blu");
    expect(findInstitution(null, "Fabric store")).toBeNull();
    expect(findInstitution(null, "Tunai")).toBeNull();
  });
  it("every glyph reference exists and ids are unique", () => {
    for (const i of INSTITUTIONS) if (i.glyph) expect(GLYPHS[i.glyph], i.id).toBeTruthy();
    expect(new Set(INSTITUTIONS.map((i) => i.id)).size).toBe(INSTITUTIONS.length);
  });
});
