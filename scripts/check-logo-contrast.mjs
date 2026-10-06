// Contrast check for the brand mark: the dim bars (40% opacity) and the bright bar are composited over the
// real backgrounds, then compared. Requirement: the two bar levels stay distinguishable (>= 3:1, WCAG 1.4.11
// non-text contrast) and the mark itself is visible on the page. Run: node scripts/check-logo-contrast.mjs
const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const over = (fg, bg, alpha) => {
  const mix = (i) => Math.round(alpha * parseInt(fg.slice(i, i + 2), 16) + (1 - alpha) * parseInt(bg.slice(i, i + 2), 16));
  return "#" + [1, 3, 5].map((i) => mix(i).toString(16).padStart(2, "0")).join("");
};

// Real backgrounds from DESIGN.md / globals.css.
const cases = [
  ["light canvas", "#F2F4F1", "#12211C"],
  ["light surface", "#FFFFFF", "#12211C"],
  ["dark canvas", "#0E1513", "#FFFFFF"],
  ["dark surface", "#16201D", "#FFFFFF"],
  ["app tile light (evergreen)", "#0B5D4B", "#FFFFFF"],
  ["app tile dark (accent lifts)", "#6CCBAE", "#0E1513"],
  ["app tile accent slate", "#2F4F7A", "#FFFFFF"],
  ["app tile accent plum", "#6B3A5E", "#FFFFFF"],
  ["app tile accent graphite", "#2E3532", "#FFFFFF"],
];

let bad = 0;
for (const [name, bg, mark] of cases) {
  const dim = over(mark, bg, 0.4);
  const bars = ratio(lum(mark), lum(dim));
  const visible = ratio(lum(mark), lum(bg));
  const ok = bars >= 3 && visible >= 3;
  if (!ok) bad++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(24)} bright ${mark} dim ${dim}  bars ${bars.toFixed(2)}:1  mark ${visible.toFixed(2)}:1`,
  );
}
// The wordmark sits next to the icon: the two must not be the same colour as each other.
process.exit(bad ? 1 : 0);
