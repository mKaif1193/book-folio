"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { BookPlus, Download, EllipsisVertical, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { db, requestPersistentStorage, type Book } from "@/lib/library/db";
import { createBook, deleteBook, exportBackup, importBackup } from "@/lib/library/repo";
import { dateStamp, downloadJson, pickJsonFile, slugify } from "@/lib/library/files";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function timeAgo(timestamp: number) {
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
}

export function Bookshelf() {
  const books = useLiveQuery(() => db.books.orderBy("updatedAt").reverse().toArray(), []);
  const stats = useLiveQuery(async () => {
    const totals = new Map<string, { words: number; chapters: number }>();
    await db.chapters.each((c) => {
      const t = totals.get(c.bookId) ?? { words: 0, chapters: 0 };
      t.words += c.wordCount;
      t.chapters += 1;
      totals.set(c.bookId, t);
    });
    return totals;
  }, []);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Book | null>(null);

  useEffect(() => void requestPersistentStorage(), []);

  const totalWords = useMemo(() => [...(stats?.values() ?? [])].reduce((sum, s) => sum + s.words, 0), [stats]);

  const backupAll = async () => {
    downloadJson(`folio-backup-${dateStamp()}.json`, await exportBackup());
    toast.success("Backup downloaded");
  };

  const restore = async () => {
    try {
      const data = await pickJsonFile();
      if (data === null) return;
      const count = await importBackup(data);
      toast.success(`Restored ${count} book${count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Your books</h1>
          <p className="text-sm text-muted-foreground">
            {books?.length
              ? `${books.length} book${books.length === 1 ? "" : "s"} · ${totalWords.toLocaleString()} words written`
              : "Saved in this browser, available offline."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={restore}>
            <Upload /> Restore
          </Button>
          <Button variant="outline" onClick={backupAll} disabled={!books?.length}>
            <Download /> Back up all
          </Button>
          <Button onClick={() => setCreating(true)}>
            <BookPlus /> New book
          </Button>
        </div>
      </div>

      {books === undefined ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-20 text-center">
          <BookPlus className="size-8 text-muted-foreground" aria-hidden />
          <h2 className="text-xl font-semibold">Start your first book</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Give it a working title. You can change everything later.
          </p>
          <Button className="mt-2" onClick={() => setCreating(true)}>
            <BookPlus /> New book
          </Button>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {books.map((book) => {
            const s = stats?.get(book.id);
            return (
              <li key={book.id} className="group relative">
                <Link
                  href={`/write/${book.id}`}
                  className="flex aspect-[2/3] flex-col justify-between rounded-r-lg rounded-l-sm border-l-8 border-l-primary/80 bg-card p-5 shadow-sm ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl leading-tight font-semibold text-balance">{book.title}</h2>
                    {book.subtitle && <p className="text-sm text-muted-foreground">{book.subtitle}</p>}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {book.author && <span className="font-heading text-sm text-foreground italic">{book.author}</span>}
                    <span>
                      {(s?.words ?? 0).toLocaleString()} words · {s?.chapters ?? 0} sections
                    </span>
                    <span>Edited {timeAgo(book.updatedAt)}</span>
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100 data-popup-open:opacity-100"
                    aria-label={`Actions for ${book.title}`}
                  >
                    <EllipsisVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={async () =>
                        downloadJson(`${slugify(book.title)}-${dateStamp()}.json`, await exportBackup([book.id]))
                      }
                    >
                      <Download /> Download backup
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(book)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <NewBookDialog open={creating} onOpenChange={setCreating} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the book and all its chapters from this browser. Download a backup first if
              you might want it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting) await deleteBook(deleting.id);
                setDeleting(null);
              }}
            >
              Delete book
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewBookDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const submit = async (formData: FormData) => {
    setPending(true);
    try {
      const book = await createBook({
        title: String(formData.get("title") ?? ""),
        subtitle: String(formData.get("subtitle") ?? ""),
        author: String(formData.get("author") ?? ""),
      });
      onOpenChange(false);
      router.push(`/write/${book.id}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">New book</DialogTitle>
          <DialogDescription>A working title is fine. You can change it any time.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required autoFocus placeholder="Untitled book" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subtitle">Subtitle (optional)</Label>
            <Input id="subtitle" name="subtitle" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="author">Author / pen name</Label>
            <Input id="author" name="author" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Create book
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
