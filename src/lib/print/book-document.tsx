import { Document, Font, Page, Text, View, pdf, StyleSheet } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import {
  isEmptyParagraph,
  opensRun,
  readingOrder,
  splitInitial,
  type Block,
  type BookModel,
  type Run,
  type Section,
} from "../publish/model";
import { POINTS_PER_INCH, TRIM_SIZES, marginsFor, type PrintSettings, type PrintStats } from "./settings";

const BODY_FONT = "EB Garamond";

let fontsRegisteredFor: string | null = null;

function registerFonts(origin: string) {
  if (fontsRegisteredFor === origin) return;
  const src = (variant: string) => `${origin}/fonts/eb-garamond/eb-garamond-${variant}.ttf`;
  Font.register({
    family: BODY_FONT,
    fonts: [
      { src: src("400-normal"), fontWeight: 400 },
      { src: src("400-italic"), fontWeight: 400, fontStyle: "italic" },
      { src: src("600-normal"), fontWeight: 600 },
      { src: src("600-italic"), fontWeight: 600, fontStyle: "italic" },
    ],
  });
  fontsRegisteredFor = origin;
}

const ONES = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 1 → "One", 42 → "Forty-Two", 100+ → "100". */
export function numberToWords(n: number): string {
  if (n >= 100) return String(n);
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 ? `${tens}-${ONES[n % 10]}` : tens;
}

type Margins = ReturnType<typeof marginsFor>;

/** Pages before the reading order begins: the title page and the copyright page. */
const FRONT_PAGES = 2;

type LayoutProps = {
  model: BookModel;
  settings: PrintSettings;
  margins: Margins;
  /** Indices into the reading-order units that need a blank verso before them. */
  blanksBefore: ReadonlySet<number>;
  /** First page of each section by id, or null on the measuring pass. */
  startPages: ReadonlyMap<string, number> | null;
  onUnitPages?: (unitIndex: number, pages: number) => void;
};

function BookDocument({ model, settings, margins, blanksBefore, startPages, onUnitPages }: LayoutProps) {
  const trim = TRIM_SIZES.find((t) => t.id === settings.trim) ?? TRIM_SIZES[0];
  const size: [number, number] = [trim.width * POINTS_PER_INCH, trim.height * POINTS_PER_INCH];
  const fs = settings.fontSize;
  const lineHeightPt = fs * settings.lineHeight;
  const { copyright, units, tocEntries } = readingOrder(model, settings.includeToc);

  // Invisible probe that reports how many pages a unit took (used for right-hand starts and contents).
  const probe = (index: number) => (
    <Text
      style={{ position: "absolute", top: 0, left: 0, fontSize: 1, opacity: 0 }}
      fixed
      render={({ subPageTotalPages }) => {
        onUnitPages?.(index, subPageTotalPages);
        return "";
      }}
    />
  );

  // Every page is laid out with the gutter on the right; recto pages are shifted afterwards
  // because react-pdf applies one padding to all pages produced by a wrapping <Page>.
  const styles = StyleSheet.create({
    page: {
      fontFamily: BODY_FONT,
      fontSize: fs,
      lineHeight: settings.lineHeight,
      paddingTop: margins.top,
      paddingBottom: margins.bottom,
      paddingLeft: margins.outside,
      paddingRight: margins.inside,
    },
    runningHead: {
      position: "absolute",
      top: margins.top / 2,
      left: margins.outside,
      right: margins.inside,
      textAlign: "center",
      fontSize: fs * 0.8,
      fontStyle: "italic",
      letterSpacing: 0.5,
    },
    folio: {
      // Anchored from the top: with `bottom`, this fixed render-prop text never appeared on wrapped pages (react-pdf 4.9).
      position: "absolute",
      top: size[1] - margins.bottom / 2 - fs,
      left: margins.outside,
      right: margins.inside,
      textAlign: "center",
      fontSize: fs * 0.85,
    },
    sceneBreak: { textAlign: "center", marginVertical: lineHeightPt * 0.5, letterSpacing: 6 },
  });

  const hyphenation = settings.hyphenate ? undefined : (word: string) => [word];
  const bodyAlign = settings.justified ? "justify" : "left";

  const renderRuns = (runs: Run[]) =>
    runs.map((run, i) => {
      if (run.kind === "break") return "\n";
      const decoration = [run.underline && "underline", run.strike && "line-through"].filter(Boolean).join(" ");
      return (
        <Text
          key={i}
          style={{
            fontWeight: run.bold ? 600 : 400,
            fontStyle: run.italic ? "italic" : "normal",
            textDecoration: (decoration || "none") as "none",
          }}
        >
          {run.text}
        </Text>
      );
    });

  const renderBlocks = (blocks: Block[], options: { dropCap: boolean; nested?: boolean }) =>
    blocks.map((block, i) => {
      switch (block.type) {
        case "paragraph": {
          if (isEmptyParagraph(block)) return <View key={i} style={{ height: lineHeightPt }} />;
          const align = block.align ?? bodyAlign;
          const flush = options.nested || opensRun(blocks, i) || align === "center" || align === "right";
          const initial = options.dropCap && i === 0 ? splitInitial(block.runs) : null;
          return (
            <Text
              key={i}
              style={{ textAlign: align, textIndent: flush ? 0 : fs * 1.5 }}
              orphans={settings.widowsOrphans}
              widows={settings.widowsOrphans}
              hyphenationCallback={hyphenation}
            >
              {initial ? (
                <>
                  {/* react-pdf has no float, so this is a raised initial rather than a true drop cap. */}
                  <Text style={{ fontSize: fs * 2.8, fontWeight: 600, lineHeight: 1 }}>{initial.initial}</Text>
                  {renderRuns(initial.rest)}
                </>
              ) : (
                renderRuns(block.runs)
              )}
            </Text>
          );
        }
        case "heading":
          return (
            <Text
              key={i}
              minPresenceAhead={lineHeightPt * 3}
              style={{
                fontSize: fs * (block.level === 2 ? 1.25 : 1.1),
                fontWeight: block.level === 2 ? 600 : 400,
                fontStyle: block.level === 3 ? "italic" : "normal",
                textAlign: block.align ?? "left",
                marginTop: lineHeightPt,
                marginBottom: lineHeightPt * 0.4,
              }}
            >
              {renderRuns(block.runs)}
            </Text>
          );
        case "scene-break":
          // Keep the break with at least two following lines so it never ends a page.
          return (
            <Text key={i} style={styles.sceneBreak} minPresenceAhead={lineHeightPt * 2}>
              * * *
            </Text>
          );
        case "quote":
          return (
            <View key={i} style={{ marginHorizontal: fs * 1.5, marginVertical: lineHeightPt * 0.5 }}>
              {renderBlocks(block.blocks, { dropCap: false, nested: true })}
            </View>
          );
        case "list":
          return (
            <View key={i} style={{ marginVertical: lineHeightPt * 0.4 }}>
              {block.items.map((item, n) => (
                <View key={n} style={{ flexDirection: "row" }} wrap={false}>
                  <Text style={{ width: fs * 1.6 }}>{block.ordered ? `${n + 1}.` : "•"}</Text>
                  <View style={{ flex: 1 }}>{renderBlocks(item, { dropCap: false, nested: true })}</View>
                </View>
              ))}
            </View>
          );
      }
    });

  const versoHead = (model.author || model.title).toUpperCase();

  const renderSection = (section: Section, index: number) => {
    if (section.kind === "part") {
      return (
        <Page key={section.id} size={size} style={styles.page}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: fs * 2.2, textAlign: "center" }}>{section.title || "Part"}</Text>
            {renderBlocks(section.blocks, { dropCap: false })}
          </View>
          {probe(index)}
        </Page>
      );
    }

    if (section.kind === "dedication" || section.kind === "epigraph") {
      return (
        <Page key={section.id} size={size} style={styles.page}>
          <View style={{ marginTop: size[1] * 0.25, fontStyle: "italic" }}>
            {renderBlocks(
              section.blocks.map((b) => (b.type === "paragraph" ? { ...b, align: b.align ?? "center" } : b)),
              { dropCap: false, nested: true },
            )}
          </View>
          {probe(index)}
        </Page>
      );
    }

    const isBody = section.area !== "front";
    const raisedInitial = settings.dropCap && (section.number !== null || section.kind === "prologue" || section.kind === "epilogue");

    return (
      <Page key={section.id} size={size} style={styles.page} wrap>
        {isBody && (
          <Text
            style={styles.runningHead}
            fixed
            render={({ pageNumber, subPageNumber }) =>
              subPageNumber === 1 ? "" : pageNumber % 2 === 0 ? versoHead : section.title || model.title
            }
          />
        )}

        <View style={{ marginTop: size[1] * 0.2, marginBottom: lineHeightPt * 2, alignItems: "center" }}>
          {section.number !== null && (
            <Text style={{ fontSize: fs * 1.05, letterSpacing: 3 }}>{`CHAPTER ${numberToWords(section.number).toUpperCase()}`}</Text>
          )}
          {section.title !== "" && (
            <Text style={{ fontSize: fs * 2, fontStyle: "italic", marginTop: lineHeightPt * 0.5, textAlign: "center" }}>
              {section.title}
            </Text>
          )}
        </View>

        {renderBlocks(section.blocks, { dropCap: raisedInitial })}

        {isBody && (
          <Text
            style={styles.folio}
            fixed
            render={({ pageNumber, subPageNumber }) => (subPageNumber === 1 ? "" : String(pageNumber))}
          />
        )}
        {probe(index)}
      </Page>
    );
  };

  const year = new Date().getFullYear();

  return (
    <Document title={model.title} author={model.author} creator="Folio">
      <Page size={size} style={styles.page}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: fs * 2.6, textAlign: "center" }}>{model.title}</Text>
          {model.subtitle !== "" && (
            <Text style={{ fontSize: fs * 1.3, marginTop: lineHeightPt, textAlign: "center", fontStyle: "italic" }}>
              {model.subtitle}
            </Text>
          )}
          {model.author !== "" && (
            <Text style={{ fontSize: fs * 1.2, marginTop: lineHeightPt * 3, letterSpacing: 1.5 }}>
              {model.author.toUpperCase()}
            </Text>
          )}
        </View>
      </Page>

      <Page size={size} style={styles.page}>
        <View style={{ flex: 1, justifyContent: "flex-end", fontSize: fs * 0.8 }}>
          {copyright ? (
            renderBlocks(copyright.blocks, { dropCap: false, nested: true })
          ) : (
            <Text>
              Copyright © {year} {model.author || model.title}. All rights reserved.
            </Text>
          )}
        </View>
      </Page>

      {units.flatMap((unit, index) => {
        const key = unit.kind === "toc" ? "toc" : unit.section.id;
        return [
          blanksBefore.has(index) ? <Page key={`blank-${key}`} size={size} style={styles.page} /> : null,
          unit.kind === "toc" ? (
            <Page key="toc" size={size} style={styles.page} wrap>
              <Text style={{ fontSize: fs * 1.6, textAlign: "center", marginTop: size[1] * 0.12, marginBottom: lineHeightPt * 2 }}>
                Contents
              </Text>
              {tocEntries.map((section) => (
                <View key={section.id} style={{ flexDirection: "row", marginBottom: lineHeightPt * 0.35 }} wrap={false}>
                  <Text style={{ flex: 1 }}>
                    {section.number !== null ? `${section.number}. ` : ""}
                    {section.title || "Untitled"}
                  </Text>
                  {/* "00" holds the same width on the measuring pass as the real number later. */}
                  <Text style={{ width: fs * 3, textAlign: "right" }}>{startPages?.get(section.id) ?? "00"}</Text>
                </View>
              ))}
              {probe(index)}
            </Page>
          ) : (
            renderSection(unit.section, index)
          ),
        ];
      })}
    </Document>
  );
}

async function layoutPass(props: Omit<LayoutProps, "onUnitPages">) {
  const unitPages: number[] = [];
  const blob = await pdf(<BookDocument {...props} onUnitPages={(i, pages) => (unitPages[i] = pages)} />).toBlob();
  return { blob, unitPages };
}

/** Works out blank versos (for right-hand starts) and each section's first page. */
function paginate(model: BookModel, settings: PrintSettings, unitPages: number[]) {
  const { units } = readingOrder(model, settings.includeToc);
  const blanks = new Set<number>();
  const startPages = new Map<string, number>();
  let lastPage = FRONT_PAGES;
  units.forEach((unit, index) => {
    if (settings.beginOnRight && (lastPage + 1) % 2 === 0) {
      blanks.add(index);
      lastPage += 1;
    }
    if (unit.kind === "section") startPages.set(unit.section.id, lastPage + 1);
    lastPage += unitPages[index] ?? 1;
  });
  return { blanks, startPages, total: lastPage };
}

/**
 * Lays the book out in passes: measure section lengths, pick the gutter for the real page
 * count, insert blank versos for right-hand starts, fill in contents page numbers, then
 * mirror the margins.
 */
export async function renderBookPdf(model: BookModel, settings: PrintSettings, origin: string) {
  const started = performance.now();
  registerFonts(origin);

  let margins = marginsFor(0);
  const measure = () => layoutPass({ model, settings, margins, blanksBefore: new Set(), startPages: null });
  let plan = paginate(model, settings, (await measure()).unitPages);

  // The gutter depends on page count, and the text width depends on the gutter: re-measure until stable.
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = marginsFor(plan.total);
    if (next.inside === margins.inside) break;
    margins = next;
    plan = paginate(model, settings, (await measure()).unitPages);
  }

  const final = await layoutPass({ model, settings, margins, blanksBefore: plan.blanks, startPages: plan.startPages });

  const doc = await PDFDocument.load(await final.blob.arrayBuffer());
  const shift = margins.inside - margins.outside;
  doc.getPages().forEach((page, i) => {
    if ((i + 1) % 2 === 1) page.translateContent(shift, 0); // recto: gutter on the left
  });
  doc.setTitle(model.title);
  if (model.author) doc.setAuthor(model.author);
  const bytes = await doc.save();

  const stats: PrintStats = {
    pages: doc.getPageCount(),
    blankPagesInserted: plan.blanks.size,
    ms: Math.round(performance.now() - started),
  };
  return { bytes, stats };
}
