/** PIN rules, shared by the server check and the PIN pad. Returns a message key under "pin.", or null. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "pin.format";
  if (new Set(pin).size === 1) return "pin.tooSimple";
  if ("0123456789012345".includes(pin) || "9876543210987654".includes(pin)) return "pin.tooSimple";
  return null;
}
