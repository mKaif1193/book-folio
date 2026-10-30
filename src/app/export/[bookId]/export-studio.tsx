"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/library/db";
import { slugify } from "@/lib/library/files";
import { buildBookModel, countWords, type BookModel } from "@/lib/publish/model";
import { buildEpub } from "@/lib/epub/build-epub";
import type { PdfWorkerRequest, PdfWorkerResponse } from "@/lib/print/pdf.worker";
import { DEFAULT_PRINT_SETTINGS, TRIM_SIZES, type PrintSettings, type PrintStats, type TrimId } from "@/lib/print/settings";

type Status = { kind: "idle" } | { kind: "rendering" } | { kind: "done"; stats: PrintStats } | { kind: "error"; message: string };

const settingsKey = (bookId: string) => `folio:print-settings:${bookId}`;

function loadSettings(bookId: string): PrintSettings {
  try {
    const stored = localStorage.getItem(settingsKey(bookId));
    return stored ? { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_PRINT_SETTINGS;
  } catch {
    return DEFAULT_PRINT_SETTINGS;
  }
}

function saveFile(bytes: Uint8Array, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportStudio() {
  const { bookId } = useParams<{ bookId: string }>();
  const data = useLiveQuery(async () => {
    const book = await db.books.get(bookId);
    if (!book) return null;
    return buildBookModel(book, await db.chapters.where("bookId").equals(bookId).toArray());
  }, [bookId]);

  if (data === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-semibold">Book not found</h1>
        <Link href="/books" className="text-sm underline underline-offset-4">
          Back to your books
        </Link>
      </div>
    );
  }
  // Mounted only on the client (after IndexedDB loads), so reading saved settings here is safe.
  return <Studio key={bookId} model={data} />;
}

function Studio({ model }: { model: BookModel }) {
  const [settings, setSettings] = useState<PrintSettings>(() => loadSettings(model.id));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pdf, setPdf] = useState<{ url: string; bytes: Uint8Array } | null>(null);
  const [epubBusy, setEpubBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);

  const wordCount = useMemo(() => countWords(model), [model]);
  const isEmpty = model.sections.every((s) => s.blocks.length === 0);

  useEffect(() => {
    const worker = new Worker(new URL("../../../lib/print/pdf.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => () => void (pdf && URL.revokeObjectURL(pdf.url)), [pdf]);

  useEffect(() => {
    try {
      localStorage.setItem(settingsKey(model.id), JSON.stringify(settings));
    } catch {
      // Storage unavailable; settings just won't be remembered.
    }
  }, [settings, model.id]);

  const render = useCallback(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const id = ++requestId.current;
    setStatus({ kind: "rendering" });

    const onMessage = (event: MessageEvent<PdfWorkerResponse>) => {
      const response = event.data;
      if (response.id !== id) return; // a newer request superseded this one
      worker.removeEventListener("message", onMessage);
      if (!response.ok) {
        setStatus({ kind: "error", message: response.error });
        return;
      }
      const bytes = response.bytes;
      setPdf({ url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })), bytes });
      setStatus({ kind: "done", stats: response.stats });
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, model, settings } satisfies PdfWorkerRequest);
  }, [model, settings]);

  // Re-render the preview shortly after settings or the book change.
  useEffect(() => {
    const timer = setTimeout(render, 400);
    return () => clearTimeout(timer);
  }, [render]);

  const update = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const filename = slugify(model.title);

  const downloadPdf = () => {
    if (!pdf) return;
    const trim = TRIM_SIZES.find((t) => t.id === settings.trim)!;
    saveFile(pdf.bytes, "application/pdf", `${filename}-print-${trim.id}.pdf`);
  };

  const downloadEpub = async () => {
    setEpubBusy(true);
    try {
      const bytes = await buildEpub(model, { dropCap: settings.dropCap, includeToc: settings.includeToc });
      saveFile(bytes, "application/epub+zip", `${filename}.epub`);
      toast.success("EPUB downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "EPUB export failed");
    } finally {
      setEpubBusy(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
        <Link
          href={`/write/${model.id}`}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to writing
        </Link>
        <h1 className="ml-2 truncate font-heading text-base font-semibold">Export · {model.title}</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_1fr]">
        <aside className="flex flex-col gap-6 overflow-y-auto border-b p-5 lg:border-r lg:border-b-0">
          {isEmpty && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              This book has no text yet. Write something first, then come back to export it.
            </p>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase">Download</h2>
            <Button size="lg" onClick={downloadEpub} disabled={epubBusy || isEmpty}>
              {epubBusy ? <Loader2 className="animate-spin" /> : <BookOpen />}
              EPUB for ebook stores
            </Button>
            <Button size="lg" variant="outline" onClick={downloadPdf} disabled={!pdf || status.kind === "rendering" || isEmpty}>
              <FileText /> Print-ready PDF
            </Button>
            <p className="text-xs text-muted-foreground">
              EPUB works with Kindle (KDP), Apple Books, Kobo and Google Play. The PDF is the interior for KDP Print or
              IngramSpark; upload your cover separately.
            </p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase">Print layout</h2>
            <div className="grid gap-2">
              <Label htmlFor="trim">Trim size</Label>
              <select
                id="trim"
                value={settings.trim}
                onChange={(e) => update("trim", e.target.value as TrimId)}
                className="h-8 rounded-lg border bg-background px-2 text-sm"
              >
                {TRIM_SIZES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <RangeField label="Font size" unit="pt" min={9} max={14} step={0.5} value={settings.fontSize} onChange={(v) => update("fontSize", v)} />
            <RangeField label="Line spacing" unit="×" min={1.15} max={1.8} step={0.05} value={settings.lineHeight} onChange={(v) => update("lineHeight", v)} />
            <RangeField label="Keep lines together at page breaks" unit="" min={1} max={3} step={1} value={settings.widowsOrphans} onChange={(v) => update("widowsOrphans", v)} />
            <div className="flex flex-col gap-3">
              <Toggle label="Justified text" checked={settings.justified} onChange={(v) => update("justified", v)} />
              <Toggle label="Hyphenation" checked={settings.hyphenate} onChange={(v) => update("hyphenate", v)} />
              <Toggle label="Large first letter in chapters" checked={settings.dropCap} onChange={(v) => update("dropCap", v)} />
              <Toggle label="Chapters start on right-hand page" checked={settings.beginOnRight} onChange={(v) => update("beginOnRight", v)} />
              <Toggle label="Table of contents" checked={settings.includeToc} onChange={(v) => update("includeToc", v)} />
            </div>
          </section>

          <div className="mt-auto flex flex-col gap-2 border-t pt-4 text-sm">
            <StatusLine status={status} />
            <p className="text-xs text-muted-foreground">About {wordCount.toLocaleString()} words in {model.sections.length} sections.</p>
            <Button variant="ghost" size="sm" className="self-start" onClick={render} disabled={status.kind === "rendering"}>
              <RefreshCw /> Refresh preview
            </Button>
          </div>
        </aside>

        <section className="min-h-[70vh] bg-muted">
          {pdf ? (
            <iframe title="Print preview" src={pdf.url} className="size-full min-h-[70vh]" />
          ) : (
            <div className="flex size-full min-h-[70vh] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Laying out pages…
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  switch (status.kind) {
    case "rendering":
      return (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Laying out pages…
        </p>
      );
    case "done":
      return (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{status.stats.pages} pages</span> · laid out in{" "}
          {(status.stats.ms / 1000).toFixed(1)} s
        </p>
      );
    case "error":
      return <p className="text-destructive">Couldn&apos;t build the PDF: {status.message}</p>;
    default:
      return null;
  }
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function RangeField(props: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = props.label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="grid gap-2">
      <div className="flex justify-between gap-2 text-sm">
        <Label htmlFor={id}>{props.label}</Label>
        <span className="tabular-nums text-muted-foreground">
          {props.value}
          {props.unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="accent-primary"
      />
    </div>
  );
}
