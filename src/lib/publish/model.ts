// A renderer-neutral snapshot of a book, built from the editor's TipTap JSON.
// Both the print PDF and the EPUB exporters consume this, so they always agree on content.

import type { JSONContent } from "@tiptap/react";
import type { Book, Chapter, ChapterSection, ChapterType } from "../library/db";

export type Align = "left" | "center" | "right" | "justify";

export type Run =
  | { kind: "text"; text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; href?: string }
  | { kind: "break" };

export type Block =
  | { type: "paragraph"; runs: Run[]; align?: Align }
  | { type: "heading"; level: 2 | 3; runs: Run[]; align?: Align }
  | { type: "scene-break" }
  | { type: "quote"; blocks: Block[] }
  | { type: "list"; ordered: boolean; items: Block[][] };

export type Section = {
  id: string;
  area: ChapterSection;
  kind: ChapterType;
  title: string;
  /** Chapter number for numbered chapters (1, 2, 3…), otherwise null. */
  number: number | null;
  blocks: Block[];
};

export type BookModel = {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  language: string;
  sections: Section[];
};

/** Sections that conventionally stay out of the table of contents. */
const NOT_IN_TOC: ChapterType[] = ["dedication", "epigraph", "copyright"];

export function inToc(section: Section) {
  return !NOT_IN_TOC.includes(section.kind);
}

export type Unit = { kind: "section"; section: Section } | { kind: "toc" };

/**
 * The printed reading order after the title and copyright pages: dedication and epigraph,
 * then the contents, then everything else (foreword, preface, chapters, back matter).
 * A copyright section, if the author wrote one, replaces the generated copyright page.
 */
export function readingOrder(model: BookModel, includeToc: boolean) {
  const copyright = model.sections.find((s) => s.kind === "copyright") ?? null;
  const flow = model.sections.filter((s) => s !== copyright);
  const leading = flow.findIndex((s) => !(s.area === "front" && (s.kind === "dedication" || s.kind === "epigraph")));
  const split = leading === -1 ? flow.length : leading;
  const units: Unit[] = [
    ...flow.slice(0, split).map((section): Unit => ({ kind: "section", section })),
    ...(includeToc && flow.some(inToc) ? [{ kind: "toc" } as Unit] : []),
    ...flow.slice(split).map((section): Unit => ({ kind: "section", section })),
  ];
  return { copyright, units, tocEntries: flow.filter(inToc) };
}

const SECTION_ORDER: Record<ChapterSection, number> = { front: 0, body: 1, back: 2 };

export function buildBookModel(book: Book, chapters: Chapter[]): BookModel {
  const ordered = [...chapters].sort(
    (a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.position - b.position,
  );
  let chapterNumber = 0;
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    language: "en",
    sections: ordered.map((chapter) => ({
      id: chapter.id,
      area: chapter.section,
      kind: chapter.type,
      title: chapter.title.trim(),
      number: chapter.type === "chapter" ? ++chapterNumber : null,
      blocks: toBlocks(chapter.content?.content ?? []),
    })),
  };
}

function toBlocks(nodes: JSONContent[]): Block[] {
  const blocks: Block[] = [];
  for (const node of nodes) {
    const align = (node.attrs?.textAlign as Align | null | undefined) ?? undefined;
    switch (node.type) {
      case "paragraph":
        blocks.push({ type: "paragraph", runs: toRuns(node.content ?? []), align: align ?? undefined });
        break;
      case "heading":
        blocks.push({ type: "heading", level: node.attrs?.level === 3 ? 3 : 2, runs: toRuns(node.content ?? []), align });
        break;
      case "horizontalRule":
        blocks.push({ type: "scene-break" });
        break;
      case "blockquote":
        blocks.push({ type: "quote", blocks: toBlocks(node.content ?? []) });
        break;
      case "bulletList":
      case "orderedList":
        blocks.push({
          type: "list",
          ordered: node.type === "orderedList",
          items: (node.content ?? []).map((item) => toBlocks(item.content ?? [])),
        });
        break;
      default:
        // Unknown node (e.g. from a future editor feature): keep its text rather than dropping it.
        if (node.content) blocks.push(...toBlocks(node.content));
    }
  }
  // Trailing empty paragraphs are just the cursor's resting place; don't print blank lines for them.
  while (blocks.length && isEmptyParagraph(blocks[blocks.length - 1])) blocks.pop();
  return blocks;
}

function toRuns(nodes: JSONContent[]): Run[] {
  return nodes.flatMap((node): Run[] => {
    if (node.type === "hardBreak") return [{ kind: "break" }];
    if (node.type !== "text" || !node.text) return [];
    const run: Run = { kind: "text", text: node.text };
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") run.bold = true;
      else if (mark.type === "italic") run.italic = true;
      else if (mark.type === "underline") run.underline = true;
      else if (mark.type === "strike") run.strike = true;
      else if (mark.type === "link" && typeof mark.attrs?.href === "string") run.href = mark.attrs.href;
    }
    return [run];
  });
}

export function isEmptyParagraph(block: Block) {
  return block.type === "paragraph" && block.runs.every((r) => r.kind === "text" && !r.text.trim());
}

export function plainText(runs: Run[]) {
  return runs.map((r) => (r.kind === "text" ? r.text : " ")).join("");
}

/**
 * Whether a paragraph starts a new run of prose (first in the section, or after a heading,
 * scene break, quote or list). Such paragraphs are set flush left, without a first-line indent.
 */
export function opensRun(blocks: Block[], index: number) {
  if (index === 0) return true;
  const previous = blocks[index - 1];
  return previous.type !== "paragraph" || isEmptyParagraph(previous);
}

/** Splits leading punctuation + first letter off the first run, for drop caps and raised initials. */
export function splitInitial(runs: Run[]): { initial: string; rest: Run[] } | null {
  const first = runs[0];
  if (!first || first.kind !== "text") return null;
  const match = first.text.match(/^(\s*["“‘'(]*\p{L})/u);
  if (!match) return null;
  const initial = match[1].trimStart();
  const remainder = first.text.slice(match[1].length);
  return { initial, rest: [{ ...first, text: remainder }, ...runs.slice(1)] };
}

function blockText(block: Block): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return plainText(block.runs);
    case "quote":
      return block.blocks.map(blockText).join(" ");
    case "list":
      return block.items.flat().map(blockText).join(" ");
    default:
      return "";
  }
}

export function countWords(model: BookModel) {
  return model.sections.reduce(
    (sum, section) => sum + section.blocks.map(blockText).join(" ").split(/\s+/).filter(Boolean).length,
    0,
  );
}
