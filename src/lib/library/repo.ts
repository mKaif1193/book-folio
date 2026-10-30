import type { JSONContent } from "@tiptap/react";
import { db, type Book, type Chapter, type ChapterSection, type ChapterType } from "./db";

const SECTION_ORDER: Record<ChapterSection, number> = { front: 0, body: 1, back: 2 };

export function sortChapters(chapters: Chapter[]) {
  return [...chapters].sort(
    (a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.position - b.position,
  );
}

export async function createBook(input: { title: string; author: string; subtitle?: string }) {
  const now = Date.now();
  const book: Book = {
    id: crypto.randomUUID(),
    title: input.title.trim() || "Untitled book",
    subtitle: input.subtitle?.trim() ?? "",
    author: input.author.trim(),
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", db.books, db.chapters, async () => {
    await db.books.add(book);
    await addChapterInternal(book.id, "body", "chapter", "Chapter 1");
  });
  return book;
}

export async function updateBook(id: string, changes: Partial<Pick<Book, "title" | "subtitle" | "author">>) {
  await db.books.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteBook(id: string) {
  await db.transaction("rw", db.books, db.chapters, async () => {
    await db.chapters.where("bookId").equals(id).delete();
    await db.books.delete(id);
  });
}

async function addChapterInternal(bookId: string, section: ChapterSection, type: ChapterType, title: string) {
  const last = await db.chapters.where("[bookId+position]").between([bookId, -Infinity], [bookId, Infinity]).last();
  const chapter: Chapter = {
    id: crypto.randomUUID(),
    bookId,
    section,
    type,
    title,
    position: (last?.position ?? 0) + 1,
    content: null,
    wordCount: 0,
    updatedAt: Date.now(),
  };
  await db.chapters.add(chapter);
  return chapter;
}

export async function addChapter(bookId: string, section: ChapterSection, type: ChapterType, title: string) {
  return db.transaction("rw", db.books, db.chapters, async () => {
    const chapter = await addChapterInternal(bookId, section, type, title);
    await db.books.update(bookId, { updatedAt: Date.now() });
    return chapter;
  });
}

export async function updateChapter(id: string, changes: Partial<Pick<Chapter, "title" | "type" | "section">>) {
  await db.chapters.update(id, { ...changes, updatedAt: Date.now() });
}

export async function saveChapterContent(id: string, content: JSONContent, wordCount: number) {
  const now = Date.now();
  await db.transaction("rw", db.books, db.chapters, async () => {
    const chapter = await db.chapters.get(id);
    if (!chapter) return;
    await db.chapters.update(id, { content, wordCount, updatedAt: now });
    await db.books.update(chapter.bookId, { updatedAt: now });
  });
}

/** Swaps a chapter with its neighbour in the same section. */
export async function moveChapter(id: string, direction: -1 | 1) {
  await db.transaction("rw", db.chapters, async () => {
    const chapter = await db.chapters.get(id);
    if (!chapter) return;
    const siblings = sortChapters(await db.chapters.where("bookId").equals(chapter.bookId).toArray()).filter(
      (c) => c.section === chapter.section,
    );
    const index = siblings.findIndex((c) => c.id === id);
    const neighbour = siblings[index + direction];
    if (!neighbour) return;
    await db.chapters.update(chapter.id, { position: neighbour.position });
    await db.chapters.update(neighbour.id, { position: chapter.position });
  });
}

export async function deleteChapter(id: string) {
  await db.chapters.delete(id);
}

// ── Backups ────────────────────────────────────────────────────────────────

const BACKUP_FORMAT = "folio-backup";
const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  books: { book: Book; chapters: Chapter[] }[];
};

export async function exportBackup(bookIds?: string[]): Promise<Backup> {
  const books = bookIds ? await db.books.bulkGet(bookIds) : await db.books.toArray();
  const entries = await Promise.all(
    books
      .filter((b): b is Book => Boolean(b))
      .map(async (book) => ({
        book,
        chapters: sortChapters(await db.chapters.where("bookId").equals(book.id).toArray()),
      })),
  );
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), books: entries };
}

/** Restores a backup as new copies, so it never overwrites books already in the library. */
export async function importBackup(data: unknown) {
  const backup = data as Partial<Backup>;
  if (backup?.format !== BACKUP_FORMAT || !Array.isArray(backup.books)) {
    throw new Error("This file isn't a Folio backup.");
  }
  if ((backup.version ?? 0) > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of the app.");
  }

  const now = Date.now();
  let restored = 0;
  await db.transaction("rw", db.books, db.chapters, async () => {
    for (const { book, chapters } of backup.books!) {
      if (!book?.title || !Array.isArray(chapters)) continue;
      const bookId = crypto.randomUUID();
      await db.books.add({ ...book, id: bookId, updatedAt: now });
      await db.chapters.bulkAdd(chapters.map((c) => ({ ...c, id: crypto.randomUUID(), bookId })));
      restored++;
    }
  });
  return restored;
}
