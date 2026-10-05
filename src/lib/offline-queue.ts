"use client";

import { openDB } from "idb";

/**
 * Offline queue (SPEC 7.7, 13): inputs made without a connection wait in IndexedDB on this device and are sent
 * as IngestDrafts when back online. Only the user's own typed text or file; no API responses are cached.
 */
const DB = "ledger-offline";
const STORE = "queue";
const db = () => openDB(DB, 1, { upgrade: (d) => d.createObjectStore(STORE, { keyPath: "id" }) });

export interface Queued {
  id: string;
  text: string;
  file: Blob | null;
  fileType: string | null;
  at: number;
}

export async function enqueueOffline(item: { text: string; file: File | null }) {
  const q: Queued = { id: crypto.randomUUID(), text: item.text, file: item.file, fileType: item.file?.type ?? null, at: Date.now() };
  await (await db()).put(STORE, q);
  // Background Sync when supported; otherwise flushOffline() runs when the app opens or goes online.
  const reg = await navigator.serviceWorker?.ready.catch(() => null);
  await (reg as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | null)?.sync?.register("ingest-queue").catch(() => undefined);
}

export async function pendingCount() {
  return (await (await db()).getAllKeys(STORE)).length;
}

/** Sends queued items to /api/v1/ingest/queue (stored as drafts for review). Returns how many were sent. */
export async function flushOffline(): Promise<number> {
  const d = await db();
  const items = (await d.getAll(STORE)) as Queued[];
  let sent = 0;
  for (const it of items) {
    const fd = new FormData();
    if (it.text) fd.set("text", it.text);
    if (it.file) fd.set("file", new File([it.file], "offline", { type: it.fileType ?? "application/octet-stream" }));
    try {
      const res = await fetch("/api/v1/ingest/queue", { method: "POST", body: fd, credentials: "same-origin" });
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429)) {
        await d.delete(STORE, it.id);
        if (res.ok) sent++;
      }
    } catch {
      break;
    }
  }
  return sent;
}

export async function clearOffline() {
  await (await db()).clear(STORE);
}
