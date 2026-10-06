/**
 * Hands a photo picked on another page over to Record. Client-side navigation keeps this module alive,
 * so a variable is enough. ponytail: a full page reload drops it; move to IndexedDB if that ever matters.
 */
let held: File | null = null;
export const holdPhoto = (f: File) => { held = f; };
export const takePhoto = () => { const f = held; held = null; return f; };
