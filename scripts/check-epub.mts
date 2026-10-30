/**
 * Builds the sample book as EPUB and checks its structure. Optionally runs the official
 * W3C EPUBCheck when EPUBCHECK_JAR points at epubcheck.jar (requires Java):
 *
 *   npm run check:epub
 *   EPUBCHECK_JAR=/path/to/epubcheck.jar npm run check:epub
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { XMLValidator } from "fast-xml-parser";
import { buildEpub } from "../src/lib/epub/build-epub";
import { SAMPLE_BOOK } from "../src/lib/print/sample-book";

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
};

const bytes = await buildEpub(SAMPLE_BOOK, { dropCap: true, includeToc: true });
const outDir = mkdtempSync(join(tmpdir(), "folio-epub-"));
const outFile = join(outDir, "sample.epub");
writeFileSync(outFile, bytes);
console.log(`Built ${outFile} (${bytes.length.toLocaleString()} bytes)\n`);

// The first local file header must be an uncompressed "mimetype" entry (OCF spec).
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const nameLength = view.getUint16(26, true);
const firstName = new TextDecoder().decode(bytes.slice(30, 30 + nameLength));
check(view.getUint32(0, true) === 0x04034b50 && firstName === "mimetype", "mimetype is the first zip entry");
check(view.getUint16(8, true) === 0, "mimetype is stored uncompressed");

const zip = await JSZip.loadAsync(bytes);
check((await zip.file("mimetype")!.async("string")) === "application/epub+zip", "mimetype content is correct");

const xmlFiles = Object.keys(zip.files).filter((name) => /\.(xhtml|opf|ncx|xml)$/.test(name));
const malformed: string[] = [];
for (const name of xmlFiles) {
  const result = XMLValidator.validate(await zip.file(name)!.async("string"));
  if (result !== true) malformed.push(`${name}: ${result.err.msg} (line ${result.err.line})`);
}
check(malformed.length === 0, `all ${xmlFiles.length} XML/XHTML files are well-formed${malformed.length ? `\n    ${malformed.join("\n    ")}` : ""}`);

const opf = await zip.file("OEBPS/content.opf")!.async("string");
const hrefs = [...opf.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const missing = hrefs.filter((href) => !zip.file(`OEBPS/${href}`));
check(missing.length === 0, `every manifest item exists (${hrefs.length} items)${missing.length ? `: missing ${missing.join(", ")}` : ""}`);

const ids = new Set([...opf.matchAll(/<item id="([^"]+)"/g)].map((m) => m[1]));
const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((m) => m[1]);
check(spine.every((id) => ids.has(id)), `spine references valid items (${spine.length} entries)`);

const chapters = SAMPLE_BOOK.sections.filter((s) => s.number !== null).length;
const nav = await zip.file("OEBPS/text/nav.xhtml")!.async("string");
check((nav.match(/<li><a href="s\d+\.xhtml">/g) ?? []).length >= chapters, "contents lists every chapter");

const firstChapter = await zip.file("OEBPS/text/s003.xhtml")!.async("string");
check(firstChapter.includes('epub:type="chapter"') && firstChapter.includes("<em>italics</em>"), "chapters carry semantics and inline formatting");

if (process.env.EPUBCHECK_JAR) {
  try {
    const output = execFileSync("java", ["-jar", process.env.EPUBCHECK_JAR, outFile], { encoding: "utf8", stdio: "pipe" });
    check(true, `EPUBCheck: ${output.trim().split("\n").filter((l) => /No errors|Messages:/.test(l)).join(" ")}`);
  } catch (error) {
    const out = (error as { stdout?: string; stderr?: string }).stdout ?? "";
    console.log(out + ((error as { stderr?: string }).stderr ?? ""));
    check(false, "EPUBCheck reported errors");
  }
} else {
  console.log("\n(Set EPUBCHECK_JAR to also run the official W3C EPUBCheck.)");
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nAll EPUB checks passed");
process.exit(failures.length ? 1 : 0);
