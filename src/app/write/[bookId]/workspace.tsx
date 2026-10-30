"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { ArrowLeft, BookUp, Check, Download, Loader2, Maximize2, Minimize2, PanelLeft, PenLine } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CHAPTER_TYPES, db, requestPersistentStorage, type Chapter, type ChapterSection, type ChapterType } from "@/lib/library/db";
import { addChapter, deleteChapter, exportBackup, moveChapter, saveChapterContent, sortChapters, updateChapter } from "@/lib/library/repo";
import { dateStamp, downloadJson, slugify } from "@/lib/library/files";
import { cn } from "@/lib/utils";
import { BookDetailsDialog } from "./book-details-dialog";
import { ChapterEditor, type ChapterEditorHandle, type SaveState } from "./chapter-editor";
import { ChapterSidebar } from "./chapter-sidebar";

const lastChapterKey = (bookId: string) => `folio:last-chapter:${bookId}`;

function readLastChapter(bookId: string) {
  try {
    return localStorage.getItem(lastChapterKey(bookId));
  } catch {
    return null;
  }
}

export function Workspace() {
  const { bookId } = useParams<{ bookId: string }>();
  const book = useLiveQuery(async () => (await db.books.get(bookId)) ?? null, [bookId]);
  const chapters = useLiveQuery(
    async () => sortChapters(await db.chapters.where("bookId").equals(bookId).toArray()),
    [bookId],
  );

  const [selectedId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [activeWords, setActiveWords] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleting, setDeleting] = useState<Chapter | null>(null);
  const editorRef = useRef<ChapterEditorHandle>(null);

  useEffect(() => void requestPersistentStorage(), []);

  // Until you pick one, open the last chapter you worked on, else the first chapter.
  const activeId = useMemo(() => {
    if (!chapters?.length) return null;
    if (selectedId && chapters.some((c) => c.id === selectedId)) return selectedId;
    const last = readLastChapter(bookId);
    return chapters.find((c) => c.id === last)?.id ?? chapters.find((c) => c.section === "body")?.id ?? chapters[0].id;
  }, [chapters, selectedId, bookId]);

  useEffect(() => {
    if (!activeId) return;
    try {
      localStorage.setItem(lastChapterKey(bookId), activeId);
    } catch {
      // Storage unavailable; we just won't remember the position.
    }
  }, [activeId, bookId]);

  const active = chapters?.find((c) => c.id === activeId) ?? null;

  const selectChapter = useCallback(async (id: string) => {
    await editorRef.current?.flush();
    setActiveId(id);
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }, []);

  const handleAdd = async (section: ChapterSection, type: ChapterType) => {
    const count = chapters?.filter((c) => c.type === "chapter").length ?? 0;
    const title = type === "chapter" ? `Chapter ${count + 1}` : CHAPTER_TYPES[type];
    const chapter = await addChapter(bookId, section, type, title);
    await selectChapter(chapter.id);
  };

  const handleDelete = async () => {
    if (!deleting || !chapters) return;
    if (deleting.id === activeId) {
      const index = chapters.findIndex((c) => c.id === deleting.id);
      setActiveId(chapters[index + 1]?.id ?? chapters[index - 1]?.id ?? null);
    }
    await deleteChapter(deleting.id);
    setDeleting(null);
  };

  const downloadBackup = useCallback(async () => {
    await editorRef.current?.flush();
    if (!book) return;
    downloadJson(`${slugify(book.title)}-${dateStamp()}.json`, await exportBackup([book.id]));
    toast.success("Backup downloaded");
  }, [book]);

  // Ctrl/Cmd+S saves immediately instead of opening the browser's "Save page" dialog.
  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        await editorRef.current?.flush();
        toast.success("Saved", { duration: 1200 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const bookWords = useMemo(
    () => (chapters ?? []).reduce((sum, c) => sum + (c.id === activeId ? activeWords : c.wordCount), 0),
    [chapters, activeId, activeWords],
  );

  const onSave = useCallback(
    (content: Parameters<typeof saveChapterContent>[1], words: number) =>
      activeId ? saveChapterContent(activeId, content, words) : Promise.resolve(),
    [activeId],
  );

  if (book === undefined || chapters === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (book === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-semibold">Book not found</h1>
        <p className="text-sm text-muted-foreground">It may have been deleted from this browser.</p>
        <Link href="/books" className="text-sm underline underline-offset-4">
          Back to your books
        </Link>
      </div>
    );
  }

  const showSidebar = sidebarOpen && !focusMode;

  return (
    <div className="flex h-dvh flex-col">
      <header
        className={cn(
          "flex h-12 shrink-0 items-center gap-2 border-b px-2 transition-opacity sm:px-3",
          focusMode && "border-transparent opacity-0 hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <Link href="/books" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to your books" title="Your books">
          <ArrowLeft className="size-4" />
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={sidebarOpen ? "Hide chapters" : "Show chapters"}
          aria-pressed={sidebarOpen}
          title="Chapters"
        >
          <PanelLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted"
          title="Edit book details"
        >
          <span className="truncate font-heading text-base font-semibold">{book.title}</span>
          <PenLine className="size-3 shrink-0 text-muted-foreground" />
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <SaveIndicator state={saveState} />
          <span className="hidden tabular-nums sm:inline">
            {activeWords.toLocaleString()} / {bookWords.toLocaleString()} words
          </span>
          <Button variant="ghost" size="icon-sm" onClick={downloadBackup} title="Download backup" aria-label="Download backup">
            <Download />
          </Button>
          <Link href={`/export/${book.id}`} className={buttonVariants({ variant: "outline", size: "sm" })} title="Export EPUB and print PDF">
            <BookUp /> Export
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setFocusMode((on) => !on)}
            title={focusMode ? "Exit focus mode" : "Focus mode"}
            aria-label={focusMode ? "Exit focus mode" : "Focus mode"}
            aria-pressed={focusMode}
          >
            {focusMode ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {showSidebar && (
          <aside className="absolute inset-y-12 left-0 z-20 w-72 shrink-0 overflow-y-auto border-r bg-background md:static md:z-auto">
            <ChapterSidebar
              chapters={chapters}
              activeId={activeId}
              activeWords={activeWords}
              onSelect={selectChapter}
              onAdd={handleAdd}
              onMove={(id, direction) => void moveChapter(id, direction)}
              onDelete={setDeleting}
            />
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          {active ? (
            <div className="mx-auto w-full max-w-[44rem] px-5 pt-10 sm:px-8">
              {active.type !== "chapter" && (
                <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">{CHAPTER_TYPES[active.type]}</p>
              )}
              <ChapterTitle key={`title-${active.id}`} chapter={active} />
              <ChapterEditor
                key={active.id}
                ref={editorRef}
                initialContent={active.content}
                onSave={onSave}
                onSaveStateChange={setSaveState}
                onWordCountChange={setActiveWords}
                focusMode={focusMode}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <p>This book has no chapters yet.</p>
              <Button onClick={() => handleAdd("body", "chapter")}>Add a chapter</Button>
            </div>
          )}
        </main>
      </div>

      <BookDetailsDialog book={book} open={detailsOpen} onOpenChange={setDetailsOpen} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title || "Untitled"}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.wordCount
                ? `Its ${deleting.wordCount.toLocaleString()} words will be permanently removed.`
                : "This section will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChapterTitle({ chapter }: { chapter: Chapter }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <input
      defaultValue={chapter.title}
      placeholder="Chapter title"
      aria-label="Chapter title"
      onChange={(event) => {
        const title = event.target.value;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void updateChapter(chapter.id, { title }), 300);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          (document.querySelector(".manuscript") as HTMLElement | null)?.focus();
        }
      }}
      className="w-full bg-transparent font-heading text-4xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
    />
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving" || state === "unsaved") {
    return (
      <span className="flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" /> Saving
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Check className="size-3" /> Saved
    </span>
  );
}
