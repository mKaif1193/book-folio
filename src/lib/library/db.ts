import Dexie, { type EntityTable } from "dexie";
import type { JSONContent } from "@tiptap/react";

export type ChapterSection = "front" | "body" | "back";

export const CHAPTER_TYPES = {
  chapter: "Chapter",
  prologue: "Prologue",
  epilogue: "Epilogue",
  part: "Part",
  dedication: "Dedication",
  epigraph: "Epigraph",
  foreword: "Foreword",
  preface: "Preface",
  introduction: "Introduction",
  copyright: "Copyright",
  acknowledgments: "Acknowledgments",
  afterword: "Afterword",
  "about-author": "About the Author",
  "also-by": "Also By",
  custom: "Custom page",
} as const;

export type ChapterType = keyof typeof CHAPTER_TYPES;

export type Book = {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  createdAt: number;
  updatedAt: number;
};

export type Chapter = {
  id: string;
  bookId: string;
  section: ChapterSection;
  type: ChapterType;
  title: string;
  /** Sort order within the book; sections are grouped at display time. */
  position: number;
  content: JSONContent | null;
  wordCount: number;
  updatedAt: number;
};

/** Everything is stored in this browser (IndexedDB), so the app works offline with no account. */
export const db = new Dexie("folio-library") as Dexie & {
  books: EntityTable<Book, "id">;
  chapters: EntityTable<Chapter, "id">;
};

db.version(1).stores({
  books: "id, updatedAt",
  chapters: "id, bookId, [bookId+position]",
});

/** Asks the browser not to evict our data under storage pressure. Safe to call repeatedly. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Not supported in this browser; backups remain the safety net.
  }
}
