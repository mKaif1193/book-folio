/// <reference lib="webworker" />
import { renderBookPdf } from "./book-document";
import type { BookModel } from "../publish/model";
import type { PrintSettings, PrintStats } from "./settings";

export type PdfWorkerRequest = { id: number; model: BookModel; settings: PrintSettings };
export type PdfWorkerResponse =
  | { id: number; ok: true; bytes: Uint8Array; stats: PrintStats }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", async (event: MessageEvent<PdfWorkerRequest>) => {
  const { id, model, settings } = event.data;
  try {
    const { bytes, stats } = await renderBookPdf(model, settings, ctx.location.origin);
    const response: PdfWorkerResponse = { id, ok: true, bytes, stats };
    ctx.postMessage(response, [bytes.buffer]);
  } catch (error) {
    const response: PdfWorkerResponse = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    ctx.postMessage(response);
  }
});
