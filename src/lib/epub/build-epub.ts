import JSZip from "jszip";
import { inToc, isEmptyParagraph, opensRun, readingOrder, type Block, type BookModel, type Run, type Section } from "../publish/model";
import type { ChapterType } from "../library/db";

export type EpubOptions = { dropCap: boolean; includeToc: boolean };

/** EPUB 3 structural semantics (epub:type) and matching ARIA roles for each section kind. */
const SEMANTICS: Partial<Record<ChapterType, { epub: string; role: string }>> = {
  chapter: { epub: "chapter", role: "doc-chapter" },
  prologue: { epub: "prologue", role: "doc-prologue" },
  epilogue: { epub: "epilogue", role: "doc-epilogue" },
  part: { epub: "part", role: "doc-part" },
  dedication: { epub: "dedication", role: "doc-dedication" },
  epigraph: { epub: "epigraph", role: "doc-epigraph" },
  foreword: { epub: "foreword", role: "doc-foreword" },
  preface: { epub: "preface", role: "doc-preface" },
  introduction: { epub: "introduction", role: "doc-introduction" },
  acknowledgments: { epub: "acknowledgments", role: "doc-acknowledgments" },
  afterword: { epub: "afterword", role: "doc-afterword" },
  copyright: { epub: "copyright-page", role: "doc-colophon" },
};

const MATTER = { front: "frontmatter", body: "bodymatter", back: "backmatter" } as const;

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

function renderRuns(runs: Run[]) {
  return runs
    .map((run) => {
      if (run.kind === "break") return "<br/>";
      let html = escapeXml(run.text);
      if (run.strike) html = `<s>${html}</s>`;
      if (run.underline) html = `<span class="u">${html}</span>`;
      if (run.italic) html = `<em>${html}</em>`;
      if (run.bold) html = `<strong>${html}</strong>`;
      if (run.href && /^(https?:|mailto:)/i.test(run.href)) html = `<a href="${escapeXml(run.href)}">${html}</a>`;
      return html;
    })
    .join("");
}

function renderBlocks(blocks: Block[], options: { dropCap: boolean; nested?: boolean }): string {
  return blocks
    .map((block, i) => {
      switch (block.type) {
        case "paragraph": {
          if (isEmptyParagraph(block)) return `<p class="blank">&#160;</p>`;
          const classes: string[] = [];
          if (options.nested || opensRun(blocks, i)) classes.push("first");
          if (block.align && block.align !== "justify") classes.push(block.align);
          if (options.dropCap && i === 0) classes.push("dropcap");
          const attr = classes.length ? ` class="${classes.join(" ")}"` : "";
          return `<p${attr}>${renderRuns(block.runs)}</p>`;
        }
        case "heading": {
          const align = block.align && block.align !== "left" ? ` class="${block.align}"` : "";
          return `<h${block.level}${align}>${renderRuns(block.runs)}</h${block.level}>`;
        }
        case "scene-break":
          return `<p class="scene-break" role="separator">* * *</p>`;
        case "quote":
          return `<blockquote>${renderBlocks(block.blocks, { dropCap: false, nested: true })}</blockquote>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items.map((item) => `<li>${renderBlocks(item, { dropCap: false, nested: true })}</li>`);
          return `<${tag}>${items.join("")}</${tag}>`;
        }
      }
    })
    .join("\n");
}

function xhtmlPage(model: BookModel, title: string, body: string, bodyType: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${model.language}" lang="${model.language}">
<head>
<meta charset="UTF-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body epub:type="${bodyType}">
${body}
</body>
</html>
`;
}

function sectionTitle(section: Section) {
  if (section.title) return section.title;
  return section.number !== null ? `Chapter ${section.number}` : "Untitled";
}

function renderSection(model: BookModel, section: Section, options: EpubOptions) {
  const semantics = SEMANTICS[section.kind];
  const typeAttr = semantics ? ` epub:type="${semantics.epub}" role="${semantics.role}"` : "";
  const title = sectionTitle(section);

  let heading = "";
  if (section.kind === "dedication" || section.kind === "epigraph") {
    // These pages carry no visible heading; the section is labelled for assistive tech instead.
  } else if (section.number !== null) {
    heading = `<p class="chapter-label">Chapter ${section.number}</p>\n<h1>${escapeXml(section.title || `Chapter ${section.number}`)}</h1>`;
  } else {
    heading = `<h1>${escapeXml(title)}</h1>`;
  }

  const label = heading ? "" : ` aria-label="${escapeXml(title)}"`;
  const dropCap = options.dropCap && (section.number !== null || section.kind === "prologue" || section.kind === "epilogue");
  const body = `<section class="${section.kind}"${typeAttr}${label}>
${heading}
${renderBlocks(section.blocks, { dropCap })}
</section>`;
  return xhtmlPage(model, title, body, MATTER[section.area]);
}

const STYLESHEET = `@charset "UTF-8";
body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; margin: 0; }
p { margin: 0; text-indent: 1.5em; text-align: justify; orphans: 2; widows: 2; }
p.first, p.center, p.right, p.left, p.blank { text-indent: 0; }
.left { text-align: left; } .center { text-align: center; } .right { text-align: right; }
h1 { font-size: 1.6em; font-weight: normal; font-style: italic; text-align: center; margin: 2.5em 0 1.5em; page-break-after: avoid; }
h2 { font-size: 1.2em; margin: 1.5em 0 0.5em; page-break-after: avoid; }
h3 { font-size: 1.05em; font-style: italic; font-weight: normal; margin: 1.25em 0 0.4em; page-break-after: avoid; }
p.chapter-label { text-indent: 0; text-align: center; text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.85em; margin-top: 3em; }
p.chapter-label + h1 { margin-top: 0.5em; }
p.scene-break { text-indent: 0; text-align: center; margin: 1em 0; letter-spacing: 0.5em; }
p.dropcap::first-letter { float: left; font-size: 3.2em; line-height: 0.85; margin: 0.05em 0.08em 0 0; }
blockquote { margin: 1em 1.5em; }
ul, ol { margin: 0.75em 0 0.75em 1.5em; padding: 0; }
.u { text-decoration: underline; }
section { page-break-before: always; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2em; font-style: normal; margin: 0 0 0.5em; }
.title-page .subtitle { font-style: italic; text-indent: 0; text-align: center; font-size: 1.2em; }
.title-page .author { text-indent: 0; text-align: center; margin-top: 3em; letter-spacing: 0.1em; text-transform: uppercase; }
.copyright-page p { text-indent: 0; font-size: 0.85em; margin-top: 0.5em; }
.dedication, .epigraph { margin-top: 30%; }
.dedication p, .epigraph p { text-indent: 0; text-align: center; font-style: italic; }
.part h1 { margin-top: 40%; font-style: normal; font-size: 2em; }
nav ol { list-style: none; margin-left: 0; }
nav li { margin: 0.4em 0; }
nav a { text-decoration: none; }
`;

/** Builds an EPUB 3 file (with an EPUB 2 NCX for older readers) from a book model. */
export async function buildEpub(model: BookModel, options: EpubOptions): Promise<Uint8Array> {
  const zip = new JSZip();
  // The mimetype entry must come first and be stored uncompressed.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  );
  zip.file("OEBPS/css/book.css", STYLESHEET);

  const { copyright, units } = readingOrder(model, options.includeToc);
  const flow = units.flatMap((unit) => (unit.kind === "section" ? [unit.section] : []));
  const year = new Date().getFullYear();

  type Doc = { id: string; href: string; title: string; linear: boolean };
  const docs: Doc[] = [];
  const add = (id: string, title: string, content: string) => {
    const href = `text/${id}.xhtml`;
    zip.file(`OEBPS/${href}`, content);
    docs.push({ id, href, title, linear: true });
  };

  const subtitle = model.subtitle ? `\n<p class="subtitle">${escapeXml(model.subtitle)}</p>` : "";
  const author = model.author ? `\n<p class="author">${escapeXml(model.author)}</p>` : "";
  add(
    "title",
    model.title,
    xhtmlPage(model, model.title, `<section class="title-page" epub:type="titlepage">\n<h1>${escapeXml(model.title)}</h1>${subtitle}${author}\n</section>`, "frontmatter"),
  );

  const copyrightBody = copyright
    ? renderBlocks(copyright.blocks, { dropCap: false, nested: true })
    : `<p>Copyright © ${year} ${escapeXml(model.author || model.title)}. All rights reserved.</p>`;
  add(
    "copyright",
    "Copyright",
    xhtmlPage(model, "Copyright", `<section class="copyright-page" epub:type="copyright-page" aria-label="Copyright">\n${copyrightBody}\n</section>`, "frontmatter"),
  );

  const sectionDocs = flow.map((section, i) => {
    const id = `s${String(i + 1).padStart(3, "0")}`;
    return { section, id, href: `text/${id}.xhtml` };
  });

  const tocItems = sectionDocs.filter(({ section }) => inToc(section));
  const firstBody = sectionDocs.find(({ section }) => section.area === "body");
  const navList = tocItems
    .map(({ section, href }) => {
      const prefix = section.number !== null ? `${section.number}. ` : "";
      return `<li><a href="${href.replace("text/", "")}">${escapeXml(prefix + sectionTitle(section))}</a></li>`;
    })
    .join("\n");
  const landmarks = [
    `<li><a epub:type="toc" href="nav.xhtml">Contents</a></li>`,
    firstBody ? `<li><a epub:type="bodymatter" href="${firstBody.id}.xhtml">Start reading</a></li>` : "",
  ].join("\n");
  // The navigation document lives with the text files so its links are simple file names.
  zip.file(
    "OEBPS/text/nav.xhtml",
    xhtmlPage(
      model,
      "Contents",
      `<nav epub:type="toc" id="toc" role="doc-toc">\n<h1>Contents</h1>\n<ol>\n${navList}\n</ol>\n</nav>\n<nav epub:type="landmarks" id="landmarks" hidden="">\n<ol>\n${landmarks}\n</ol>\n</nav>`,
      "frontmatter",
    ),
  );
  docs.push({ id: "nav", href: "text/nav.xhtml", title: "Contents", linear: options.includeToc });

  for (const { section, id } of sectionDocs) add(id, sectionTitle(section), renderSection(model, section, options));

  // Legacy NCX for EPUB 2 readers.
  const navPoints = tocItems
    .map(
      ({ section, href }, i) => `    <navPoint id="np${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(sectionTitle(section))}</text></navLabel>
      <content src="${href}"/>
    </navPoint>`,
    )
    .join("\n");
  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:${model.id}"/></head>
  <docTitle><text>${escapeXml(model.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`,
  );

  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const manifest = [
    `<item id="css" href="css/book.css" media-type="text/css"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    ...docs.map(
      (d) => `<item id="${d.id}" href="${d.href}" media-type="application/xhtml+xml"${d.id === "nav" ? ` properties="nav"` : ""}/>`,
    ),
  ];
  // Reading order: title, copyright, then the same order as print (contents after dedication/epigraph).
  // Without a printed contents page, the navigation document still ships, outside the linear reading order.
  const sectionIds = new Map(sectionDocs.map((d) => [d.section, d.id]));
  const order = [
    "title",
    "copyright",
    ...units.map((unit) => (unit.kind === "toc" ? "nav" : sectionIds.get(unit.section)!)),
    ...(units.some((unit) => unit.kind === "toc") ? [] : ["nav"]),
  ];
  const spine = order.map((id) => {
    const doc = docs.find((d) => d.id === id)!;
    return `<itemref idref="${id}"${doc.linear ? "" : ` linear="no"`}/>`;
  });

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${model.language}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${model.id}</dc:identifier>
    <dc:title>${escapeXml(model.title)}</dc:title>${model.author ? `\n    <dc:creator>${escapeXml(model.author)}</dc:creator>` : ""}
    <dc:language>${model.language}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifest.join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spine.join("\n    ")}
  </spine>
</package>
`,
  );

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip", compression: "DEFLATE" });
}
