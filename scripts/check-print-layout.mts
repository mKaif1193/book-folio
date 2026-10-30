/**
 * Renders the sample book through the real print pipeline and checks layout rules
 * from the PDF's text positions. Needs the app running (fonts are fetched from it):
 *
 *   npm run build && npm run start      # in one terminal
 *   npm run check:print                 # in another
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderBookPdf } from "../src/lib/print/book-document";
import { SAMPLE_BOOK } from "../src/lib/print/sample-book";
import { DEFAULT_PRINT_SETTINGS, POINTS_PER_INCH, TRIM_SIZES, marginsFor, type TrimId } from "../src/lib/print/settings";

const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
};

const settings = {
  ...DEFAULT_PRINT_SETTINGS,
  trim: (process.env.TRIM as TrimId | undefined) ?? DEFAULT_PRINT_SETTINGS.trim,
  fontSize: Number(process.env.FONT_SIZE ?? DEFAULT_PRINT_SETTINGS.fontSize),
};
const { bytes, stats } = await renderBookPdf(SAMPLE_BOOK, settings, origin);
console.log(`Rendered ${stats.pages} pages in ${stats.ms} ms (${stats.blankPagesInserted} blank versos)\n`);

const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
const trim = TRIM_SIZES.find((t) => t.id === settings.trim)!;
const margins = marginsFor(stats.pages);

type PageInfo = { n: number; text: string; minX: number; lines: { str: string; y: number }[] };
const pages: PageInfo[] = [];
for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n);
  const { width, height } = page.getViewport({ scale: 1 });
  if (n === 1) {
    check(
      Math.abs(width - trim.width * POINTS_PER_INCH) < 0.5 && Math.abs(height - trim.height * POINTS_PER_INCH) < 0.5,
      `page size is ${trim.label} (${width}×${height}pt)`,
    );
  }
  const content = await page.getTextContent();
  const items = content.items.flatMap((item) => ("str" in item && item.str.trim() ? [item] : []));
  if (process.env.DEBUG_PAGES?.split(",").includes(String(n))) {
    console.log(`--- page ${n}`);
    items.forEach((i) => console.log(`  ${Math.round(i.transform[4])},${Math.round(i.transform[5])}  ${i.str.slice(0, 50)}`));
  }
  pages.push({
    n,
    text: items.map((i) => i.str).join(" "),
    minX: Math.min(...items.map((i) => i.transform[4]), Infinity),
    lines: items.map((i) => ({ str: i.str, y: i.transform[5] })),
  });
}

// Letter-spaced headings come back as "C H A P T E R".
const openers = pages.filter((p) => /C\s*H\s*A\s*P\s*T\s*E\s*R\s+[A-Z]/.test(p.text));

// Lines in the body must step down the page; an overlap means a line box was mis-measured.
const overlaps = pages.filter((p) => {
  const bodyLines = p.lines.filter((l) => l.str.length > 20);
  return bodyLines.some((l, i) => i > 0 && l.y > bodyLines[i - 1].y + 1);
});
check(overlaps.length === 0, `no overlapping lines${overlaps.length ? ` (pages ${overlaps.map((p) => p.n).join(", ")})` : ""}`);
const chapters = SAMPLE_BOOK.sections.filter((s) => s.number !== null);
check(openers.length === chapters.length, `found ${openers.length} chapter openers`);
check(openers.every((p) => p.n % 2 === 1), `chapters open on recto pages: ${openers.map((p) => p.n).join(", ")}`);

const pageWith = (needle: string) => pages.find((p) => p.text.replace(/\s+/g, " ").includes(needle));
const dedication = pageWith("For everyone who kept a light on.");
// Match the part page itself, not the contents page that lists it.
const part = pages.find((p) => p.text.trim() === "Part One: The Letter");
const acknowledgments = pages.find((p) => p.text.trim().startsWith("Acknowledgments"));
check(
  [dedication, part, acknowledgments].every((p) => p && p.n % 2 === 1),
  `dedication, part and back matter open on recto pages: ${[dedication, part, acknowledgments].map((p) => p?.n).join(", ")}`,
);

const blanks = pages.filter((p) => p.n > 2 && p.text === "");
check(blanks.every((p) => p.n % 2 === 0), `blank pages are versos: ${blanks.map((p) => p.n).join(", ") || "none"}`);

// Contents: each chapter's listed page number matches the page its opener is on.
const toc = pages.filter((p) => p.text.startsWith("Contents"));
check(
  toc.length > 0 && dedication !== undefined && toc[0].n > dedication.n && toc[0].n % 2 === 1,
  `contents follows the dedication on a recto page (page ${toc[0]?.n})`,
);
const tocMismatches = chapters.filter((chapter) => {
  const entry = toc.flatMap((p) => p.lines).find((l) => l.str.includes(chapter.title));
  const number = entry && toc.flatMap((p) => p.lines).find((l) => Math.abs(l.y - entry.y) < 2 && /^\d+$/.test(l.str.trim()));
  const opener = openers.find((p) => p.text.includes(chapter.title));
  return !number || !opener || Number(number.str) !== opener.n;
});
check(tocMismatches.length === 0, `contents page numbers match chapter openers${tocMismatches.length ? ` (wrong: ${tocMismatches.map((c) => c.title).join(", ")})` : ""}`);

// Body pages: inside chapters, excluding openers and blank pages.
const firstOpener = openers[0]?.n ?? Infinity;
const body = pages.filter((p) => p.n > firstOpener && p.n < (acknowledgments?.n ?? Infinity) && p.text !== "" && !openers.includes(p));
const rectoX = body.filter((p) => p.n % 2 === 1).map((p) => p.minX);
const versoX = body.filter((p) => p.n % 2 === 0).map((p) => p.minX);
const near = (values: number[], target: number) => values.every((x) => Math.abs(x - target) < 3);
check(near(versoX, margins.outside), `verso text starts at outside margin ${margins.outside}pt`);
check(near(rectoX, margins.inside), `recto text starts at gutter margin ${margins.inside}pt`);

// Chapter openers carry no running head or folio; body pages carry a folio.
const pageHeight = trim.height * POINTS_PER_INCH;
const topBand = (p: PageInfo) => p.lines.filter((l) => l.y > pageHeight - margins.top);
const bottomBand = (p: PageInfo) => p.lines.filter((l) => l.y < margins.bottom);
check(openers.every((p) => topBand(p).length === 0 && bottomBand(p).length === 0), "chapter openers have no running head or folio");
check(
  body.every((p) => bottomBand(p).some((l) => l.str.trim() === String(p.n))),
  "body pages show their page number in the footer",
);
check(
  body.every((p) => topBand(p).length > 0),
  "body pages show a running head (author on versos, chapter title on rectos)",
);

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nAll print layout checks passed");
process.exit(failures.length ? 1 : 0);
