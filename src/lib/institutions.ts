// Banks, e-wallets, paylater and brokers people commonly hold, with a brand colour and either a glyph (from
// brand-glyphs.ts) or a short monogram. Used to show a recognisable mark next to an account. Colours are
// approximations of each brand's main colour; marks are trademarks of their owners.

export type InstitutionKind = "BANK" | "EWALLET" | "PAYLATER" | "INVESTMENT" | "CARD";

export interface Institution {
  id: string;
  name: string;
  kind: InstitutionKind;
  /** Background of the tile. */
  color: string;
  /** Foreground on the tile; white unless the brand colour is light. */
  ink?: string;
  /** Key in GLYPHS, when a vector mark exists. */
  glyph?: string;
  /** Up to four characters, used when there is no glyph. */
  mono?: string;
  /** Extra lowercase words that identify the institution in an account name. */
  aliases?: string[];
}

export const INSTITUTIONS: Institution[] = [
  // Banks (Indonesia)
  { id: "bca", name: "BCA", kind: "BANK", color: "#0060AF", mono: "BCA", aliases: ["bank central asia", "klikbca", "mybca"] },
  { id: "mandiri", name: "Bank Mandiri", kind: "BANK", color: "#003D79", ink: "#FFB700", mono: "mdr", aliases: ["mandiri", "livin"] },
  { id: "bri", name: "BRI", kind: "BANK", color: "#00529C", mono: "BRI", aliases: ["bank rakyat indonesia", "brimo"] },
  { id: "bni", name: "BNI", kind: "BANK", color: "#F15A23", mono: "BNI", aliases: ["bank negara indonesia", "wondr"] },
  { id: "btn", name: "BTN", kind: "BANK", color: "#1E4D9C", mono: "BTN", aliases: ["bank tabungan negara"] },
  { id: "bsi", name: "BSI", kind: "BANK", color: "#00A39D", mono: "BSI", aliases: ["bank syariah indonesia"] },
  { id: "cimb", name: "CIMB Niaga", kind: "BANK", color: "#B5121B", mono: "CIMB", aliases: ["cimb", "octo"] },
  { id: "permata", name: "PermataBank", kind: "BANK", color: "#E31E24", mono: "PRM", aliases: ["permata"] },
  { id: "danamon", name: "Danamon", kind: "BANK", color: "#F39200", mono: "DNM", aliases: ["d-bank"] },
  { id: "ocbc", name: "OCBC", kind: "BANK", color: "#E30613", mono: "OCBC", aliases: ["nyala"] },
  { id: "panin", name: "Panin Bank", kind: "BANK", color: "#0A4D8C", mono: "PNB", aliases: ["panin"] },
  { id: "maybank", name: "Maybank", kind: "BANK", color: "#FFC72C", ink: "#1A1A1A", mono: "MAY" },
  { id: "mega", name: "Bank Mega", kind: "BANK", color: "#F2A900", ink: "#1A1A1A", mono: "MEGA", aliases: ["mega"] },
  { id: "uob", name: "UOB", kind: "BANK", color: "#0B3B8C", mono: "UOB", aliases: ["tmrw"] },
  { id: "dbs", name: "DBS", kind: "BANK", color: "#E1001A", mono: "DBS", aliases: ["digibank"] },
  { id: "citi", name: "Citibank", kind: "BANK", color: "#056DAE", mono: "citi", aliases: ["citi"] },
  { id: "hsbc", name: "HSBC", kind: "BANK", color: "#DB0011", glyph: "hsbc" },
  { id: "jago", name: "Bank Jago", kind: "BANK", color: "#F6A11A", ink: "#1A1A1A", mono: "jago", aliases: ["jago"] },
  { id: "jenius", name: "Jenius", kind: "BANK", color: "#00B5E5", mono: "J" },
  { id: "seabank", name: "SeaBank", kind: "BANK", color: "#FF6A13", mono: "Sea", aliases: ["sea bank"] },
  { id: "blu", name: "blu by BCA", kind: "BANK", color: "#00AEEF", mono: "blu", aliases: ["blu"] },
  { id: "allo", name: "Allo Bank", kind: "BANK", color: "#5B2D90", mono: "allo", aliases: ["allo"] },
  { id: "neo", name: "Bank Neo Commerce", kind: "BANK", color: "#FDD100", ink: "#1A1A1A", mono: "neo", aliases: ["neobank", "bnc"] },
  { id: "linebank", name: "LINE Bank", kind: "BANK", color: "#00B900", mono: "LINE", aliases: ["line bank"] },
  { id: "superbank", name: "Superbank", kind: "BANK", color: "#6B3FE0", mono: "S" },
  { id: "bankdki", name: "Bank DKI", kind: "BANK", color: "#E31E24", mono: "DKI", aliases: ["dki"] },
  { id: "bjb", name: "bank bjb", kind: "BANK", color: "#1B5BA7", mono: "bjb" },
  // Banks (abroad)
  { id: "chase", name: "Chase", kind: "BANK", color: "#117ACA", glyph: "chase" },
  { id: "bofa", name: "Bank of America", kind: "BANK", color: "#012169", glyph: "bankofamerica", aliases: ["bofa"] },
  { id: "wellsfargo", name: "Wells Fargo", kind: "BANK", color: "#D71E28", glyph: "wellsfargo" },
  { id: "monzo", name: "Monzo", kind: "BANK", color: "#14233C", glyph: "monzo" },
  { id: "n26", name: "N26", kind: "BANK", color: "#48AC98", glyph: "n26" },
  { id: "revolut", name: "Revolut", kind: "BANK", color: "#191C1F", glyph: "revolut" },
  { id: "wise", name: "Wise", kind: "BANK", color: "#9FE870", ink: "#163300", glyph: "wise", aliases: ["transferwise"] },
  // E-wallets
  { id: "gopay", name: "GoPay", kind: "EWALLET", color: "#00AED6", glyph: "gojek", aliases: ["go-pay", "gojek"] },
  { id: "ovo", name: "OVO", kind: "EWALLET", color: "#4C3494", mono: "OVO" },
  { id: "dana", name: "DANA", kind: "EWALLET", color: "#118EEA", mono: "DANA" },
  { id: "shopeepay", name: "ShopeePay", kind: "EWALLET", color: "#EE4D2D", glyph: "shopee", aliases: ["shopee pay", "shopee"] },
  { id: "linkaja", name: "LinkAja", kind: "EWALLET", color: "#E82529", mono: "LA", aliases: ["link aja"] },
  { id: "grabpay", name: "GrabPay", kind: "EWALLET", color: "#00B14F", glyph: "grab", aliases: ["grab pay", "grab"] },
  { id: "astrapay", name: "AstraPay", kind: "EWALLET", color: "#0053A0", mono: "AP" },
  { id: "isaku", name: "i.saku", kind: "EWALLET", color: "#E4002B", mono: "i.s", aliases: ["isaku"] },
  { id: "flip", name: "Flip", kind: "EWALLET", color: "#FD6542", mono: "flip" },
  { id: "paypal", name: "PayPal", kind: "EWALLET", color: "#002991", glyph: "paypal" },
  { id: "alipay", name: "Alipay", kind: "EWALLET", color: "#1677FF", glyph: "alipay" },
  { id: "wechatpay", name: "WeChat Pay", kind: "EWALLET", color: "#07C160", glyph: "wechat", aliases: ["wechat"] },
  { id: "paytm", name: "Paytm", kind: "EWALLET", color: "#20336B", glyph: "paytm" },
  { id: "googlepay", name: "Google Pay", kind: "EWALLET", color: "#4285F4", glyph: "googlepay", aliases: ["gpay"] },
  { id: "applepay", name: "Apple Pay", kind: "EWALLET", color: "#000000", glyph: "applepay" },
  { id: "samsungpay", name: "Samsung Pay", kind: "EWALLET", color: "#1428A0", glyph: "samsungpay" },
  // Paylater
  { id: "kredivo", name: "Kredivo", kind: "PAYLATER", color: "#FF6F00", mono: "K" },
  { id: "akulaku", name: "Akulaku", kind: "PAYLATER", color: "#E8323A", mono: "AK" },
  { id: "spaylater", name: "SPayLater", kind: "PAYLATER", color: "#EE4D2D", glyph: "shopee", aliases: ["shopee paylater", "spay later"] },
  { id: "gopaylater", name: "GoPayLater", kind: "PAYLATER", color: "#00AED6", glyph: "gojek", aliases: ["gopay later", "gopay paylater"] },
  { id: "traveloka", name: "Traveloka PayLater", kind: "PAYLATER", color: "#0194F3", mono: "TVLK", aliases: ["traveloka"] },
  { id: "atome", name: "Atome", kind: "PAYLATER", color: "#F0FF5F", ink: "#1A1A1A", mono: "A" },
  { id: "indodana", name: "Indodana", kind: "PAYLATER", color: "#0F4C81", mono: "ID" },
  // Cards
  { id: "visa", name: "Visa", kind: "CARD", color: "#1A1F71", glyph: "visa" },
  { id: "mastercard", name: "Mastercard", kind: "CARD", color: "#EB001B", glyph: "mastercard" },
  { id: "amex", name: "American Express", kind: "CARD", color: "#2E77BC", glyph: "americanexpress", aliases: ["amex"] },
  // Investment
  { id: "bibit", name: "Bibit", kind: "INVESTMENT", color: "#00AB6B", mono: "B" },
  { id: "ajaib", name: "Ajaib", kind: "INVESTMENT", color: "#3E40F6", mono: "A" },
  { id: "stockbit", name: "Stockbit", kind: "INVESTMENT", color: "#00B77F", mono: "SB" },
  { id: "pluang", name: "Pluang", kind: "INVESTMENT", color: "#0A2DFF", mono: "P" },
  { id: "bareksa", name: "Bareksa", kind: "INVESTMENT", color: "#00A99D", mono: "BRK" },
  { id: "ipot", name: "IPOT", kind: "INVESTMENT", color: "#F7941D", mono: "IPOT", aliases: ["indo premier"] },
  { id: "indodax", name: "Indodax", kind: "INVESTMENT", color: "#1A3A7A", mono: "IDX" },
  { id: "pintu", name: "Pintu", kind: "INVESTMENT", color: "#0A68F4", mono: "P" },
  { id: "tokocrypto", name: "Tokocrypto", kind: "INVESTMENT", color: "#1E2026", ink: "#F0B90B", mono: "TKO" },
  { id: "binance", name: "Binance", kind: "INVESTMENT", color: "#F0B90B", ink: "#1A1A1A", glyph: "binance" },
];

const byId = new Map(INSTITUTIONS.map((i) => [i.id, i]));

const words = (i: Institution) => [i.name.toLowerCase(), i.id, ...(i.aliases ?? [])];
// Longest words first so "gopay later" wins over "gopay" and "blu by bca" over "bca".
const INDEX = INSTITUTIONS.flatMap((i) => words(i).map((w) => ({ w, i }))).sort((a, b) => b.w.length - a.w.length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds the institution named in an account's institution field, or else in its name. */
export function findInstitution(institution?: string | null, name?: string | null): Institution | null {
  for (const text of [institution, name]) {
    if (!text) continue;
    const t = ` ${text.toLowerCase()} `;
    const exact = byId.get(text.trim().toLowerCase());
    if (exact) return exact;
    for (const { w, i } of INDEX) if (new RegExp(`(^|[^a-z0-9])${escape(w)}([^a-z0-9]|$)`).test(t)) return i;
  }
  return null;
}
