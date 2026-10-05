import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { bad, notFound } from "./http";

/** Files live under DATA_DIR/attachments, outside the web root, served only by a session-checked route (SPEC 14). */
const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/csv"] as const;

const dir = () => path.resolve(process.env.DATA_DIR ?? "./data", "attachments");

/** Content sniffing: the declared type must match the file's magic bytes. */
export function sniff(buf: Buffer): (typeof ALLOWED)[number] | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.length >= 5 && buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  // CSV: printable text without NUL bytes in the first 4 KB.
  const head = buf.subarray(0, 4096);
  if (head.length && !head.includes(0) && /^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]*$/.test(head.toString("utf8"))) return "text/csv";
  return null;
}

/** Removes EXIF/XMP and comments from JPEG (APP1..APP15, COM) and metadata chunks from PNG. */
export function stripMetadata(buf: Buffer, mime: string): Buffer {
  if (mime === "image/jpeg") {
    const out: Buffer[] = [buf.subarray(0, 2)];
    let i = 2;
    while (i + 4 <= buf.length && buf[i] === 0xff) {
      const marker = buf[i + 1]!;
      if (marker === 0xda) break; // start of scan: image data follows
      const len = buf.readUInt16BE(i + 2);
      const keep = !((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe);
      if (keep) out.push(buf.subarray(i, i + 2 + len));
      i += 2 + len;
    }
    out.push(buf.subarray(i));
    return Buffer.concat(out);
  }
  if (mime === "image/png") {
    const out: Buffer[] = [buf.subarray(0, 8)];
    let i = 8;
    while (i + 12 <= buf.length) {
      const len = buf.readUInt32BE(i);
      const type = buf.subarray(i + 4, i + 8).toString("latin1");
      const chunk = buf.subarray(i, i + 12 + len);
      if (!["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(type)) out.push(chunk);
      i += 12 + len;
    }
    return Buffer.concat(out);
  }
  // WebP metadata (EXIF/XMP chunks) is left in place only when the container is not simple; strip chunk types.
  if (mime === "image/webp") {
    const chunks: Buffer[] = [];
    let i = 12;
    while (i + 8 <= buf.length) {
      const type = buf.subarray(i, i + 4).toString("latin1");
      const len = buf.readUInt32LE(i + 4);
      const total = 8 + len + (len % 2);
      if (type !== "EXIF" && type !== "XMP ") chunks.push(buf.subarray(i, i + total));
      i += total;
    }
    const body = Buffer.concat(chunks);
    const header = Buffer.alloc(12);
    header.write("RIFF", 0, "latin1");
    header.writeUInt32LE(body.length + 4, 4);
    header.write("WEBP", 8, "latin1");
    return Buffer.concat([header, body]);
  }
  return buf;
}

export async function saveAttachment(householdId: string, memberId: string | null, data: Buffer, declared?: string | null) {
  if (data.length === 0) throw bad("file_empty");
  if (data.length > MAX_BYTES) throw bad("file_too_large");
  const mime = sniff(data);
  if (!mime || (declared && declared !== mime && !(declared === "application/vnd.ms-excel" && mime === "text/csv"))) throw bad("file_type");
  const clean = stripMetadata(data, mime);
  const sha = createHash("sha256").update(clean).digest("hex");
  await mkdir(dir(), { recursive: true, mode: 0o700 });
  const name = `${randomBytes(16).toString("hex")}`;
  await writeFile(path.join(dir(), name), clean, { mode: 0o600 });
  return prisma.attachment.create({ data: { householdId, path: name, mime, size: clean.length, sha256: sha, createdById: memberId } });
}

/**
 * Read a stored file. With `memberId`, the member must have uploaded it or be able to see a transaction it is
 * attached to (private accounts stay private in two-person mode, scenario 24).
 */
export async function readAttachment(householdId: string, id: string, memberId?: string | null) {
  const a = await prisma.attachment.findFirst({ where: { id, householdId, deletedAt: null } });
  if (!a) throw notFound();
  if (memberId && a.createdById !== memberId) {
    const { txScope } = await import("./ledger/scope");
    const visible = await prisma.transaction.count({ where: { AND: [txScope({ householdId, memberId }), { attachmentId: a.id }] } });
    if (!visible) throw notFound();
  }
  // Stored names are random hex; reject anything else so a row can never point outside the folder.
  if (!/^[a-f0-9]{32}$/.test(a.path)) throw notFound();
  return { meta: a, data: await readFile(path.join(dir(), a.path)) };
}
