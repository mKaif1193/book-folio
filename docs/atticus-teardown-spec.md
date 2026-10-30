# Atticus Teardown & Build Spec

Spec for building our own book writing + formatting app (working name: **TBD**), based on a public-surface teardown of Atticus (atticus.io / app.atticus.io). Target stack: **Next.js + Supabase**.

> Scope of research (2026-10-30): marketing site, Intercom help center, and the public app shell + JS bundles of app.atticus.io. No account was used, so nothing behind login was observed at runtime. Each finding is tagged **[Observed]** (seen directly in pages/bundles), **[Inferred]** (strong reading of bundle evidence), or **[Unknown]**.
>
> We are building our own product: own name, branding, UI, themes and code. Use Atticus only as a feature/UX reference; do not copy its code, assets, theme designs, or copy text.

---

## 1. What Atticus is

An all-in-one **write → format → export** tool for self-published authors. Installable PWA (Windows, Mac, Linux, Chromebook), works offline, syncs to cloud. One-time price $147, unlimited books. Main competitor it positions against: Vellum (Mac-only, $249). [Observed]

Two modes in one app:
1. **Writing**: chapter-based rich-text editor with goals, word counts and collaboration.
2. **Formatting**: theme picker/builder plus a live device previewer; exports to EPUB, print PDF and DOCX.

---

## 2. Atticus technical architecture (what the bundles reveal)

| Layer | Atticus uses | Evidence |
|---|---|---|
| App framework | React 17 SPA, Create React App build, PWA service worker (Workbox precache) | [Observed] `asset-manifest.json`, `service-worker.js`, `react-dom v17.0.2` license |
| UI kit | Ant Design (custom `at-primary` / `at-secondary` / `at-ghost` button types) | [Observed] |
| State | MobX (+ immer) | [Observed] |
| Editor | **Slate** + **Plate (udecode)** plugins | [Observed] `slate-*`, `udecode`, `plate-` strings |
| Real-time collab | **Yjs** + **slate-yjs** (cursor/position storage, history) | [Observed] `slate-yjs-*` strings |
| Offline storage | **y-indexeddb** (Yjs docs persisted in IndexedDB) | [Observed] |
| REST API | `https://atticus-api-prod-v2.atticus.pub/`, Bearer token auth | [Observed] |
| Yjs sync servers | `wss://atticus-y-ws-sync-api-prod-v2.atticus.pub/` + HTTP `atticus-y-http-sync-api-prod-v2.atticus.pub` | [Observed] |
| Other realtime | AWS API Gateway WebSocket (`execute-api.us-east-1`), legacy `atticus-app-sync-api-prod` | [Observed] Purpose [Unknown], likely notifications/legacy sync |
| Static content | `prod.content.atticus.io` (fonts, theme images, presets) | [Observed] host; contents [Inferred] |
| Print PDF | **@react-pdf** renderer in a **Web Worker** (react-reconciler, fontkit, Knuth-Plass line breaking, hyphenation, number-to-words for "Chapter One") | [Observed] libs in worker chunks; [Inferred] it is react-pdf's layout engine |
| EPUB | Separate Web Worker using **JSZip + EJS templates** | [Observed] |
| Previewer | `TwoPageViewWorker` worker for print spread preview | [Observed] name; internals [Unknown] |
| Error tracking | Sentry | [Observed] |
| In-app help | Stonly widget + Intercom help center | [Observed] |
| Payments | ThriveCart checkout (outside the app); `limited-app.atticus.io` hints at a restricted/unpaid mode | [Observed] / [Inferred] |
| Integrations | BookBrush (covers), "booklinker" (universal book links), social links list | [Observed] |

**Key takeaway:** all heavy work (PDF, EPUB, preview) runs **in the browser in Web Workers**. The backend mainly does CRUD, auth and Yjs sync. That keeps it offline-capable and cheap to run.

### 2.1 REST endpoints seen in the main bundle [Observed]

```
/auth/signin  /auth/signup  /auth/sign-out  /auth/forgotPassword  /auth/resetPassword  /auth/invite/:id
/books  /books/initial  /books/sync  /books/validate  /books/import/  /books/import-chapters  /books/boxset
/chapters/  /syncChapter  /sync  /snapshots
/chapter-templates/ (filtered, clone/:id, updates-sync, chapters-to-update)
/book-themes  /book-theme-favourites  /theme
/fonts  /fonts/favourite  /fonts/user-favourites
/image-gallery-images (all, delete, bulk-move, bulk-delete)  /image-gallery-folders
/goals/setGoal  getGoal  fetchGoal  editGoal  deleteGoal  completeGoal
/bookCollaborator (collaborators, pending, activate, user/:id)
/export/  /book-usage  /booklinker
```

These map almost 1:1 to the domain model in section 5.

---

## 3. Feature inventory

### 3.1 Book structure
- Book has **Front matter / Body / Back matter**, with a "body-separator" between them. [Observed]
- **Chapter types** [Observed]: `chapter`, `uncategorized`, `custom`, `title`, `half-title`, `toc`, `copyrights`, `dedication`, `epigraph`, `foreword`, `preface`, `introduction`, `prologue`, `epilogue`, `afterword`, `acknowledgments`, `about-author`, `also-by`, `blurbs`, `endnotes`, `image` (full-page image), `volume`, `part`.
- **Volumes and Parts** group chapters; **Boxsets** combine several books (`/books/boxset`). [Observed]
- **Chapter templates**: reusable chapters (e.g. "Also by", "About the author") synced across books, with "chapters-to-update" propagation. [Observed]
- Per-chapter "**Begin on**" (right-hand page / any page), and Atticus inserts blank pages automatically. [Observed]
- Per-chapter options: hide chapter image / heading / page number / header-footer / first-sentence formatting / hide in TOC, smaller title, invert text color. [Observed]
- Drag-and-drop chapter reordering. [Observed]
- Book details: title, subtitle, author/pen name, publisher, ISBN, etc. Used in title page, copyright and headers. [Inferred field list]

### 3.2 Writing editor
- Marks: bold, italic, underline, strikethrough, monospace, small caps, sans-serif, subscript, superscript. [Observed]
- Blocks: paragraph, H2–H6 (H1 is the chapter title), bullet/numbered lists, align left/center/right/justify, block quote, **verse**, hanging indent, **callout box** (styled, with saveable presets), **scene break**, **page break**, image (sizes, alignment, captions [Unknown]), **text-message** (chat bubble) element, tables (basic), hr, links, **endnotes/footnotes**, **split chapter** action. [Observed]
- Find & replace across the whole book. [Observed]
- Writing **goals** and habit tracker, word counts per chapter/book. [Observed]
- **Snapshots** (manual backups / restore). Full version control was listed as "coming soon". [Observed]
- Smart quotes. [Observed, article title]
- Image gallery with folders shared across books. [Observed]
- Collaboration: invite collaborators per book, comments, tracked edits ("Edits"), resolve/unresolve, owner-only delete, export check for unresolved items. [Observed]

### 3.3 Formatting / theme builder
- 17 preset themes + custom theme builder ("Edit as new theme", duplicate, favourite). [Observed]
- **Chapter heading**: show/hide number, title, subtitle, image; each with font, size, style, alignment; number format auto (1 / One / I). [Observed]
- **Chapter image**: one image for every chapter or per-chapter images; placement relative to number/title; background image with opacity, light/dark text, full-bleed for print. [Observed]
- **First paragraph**: drop cap and/or lead-in small caps, applied at chapter start or also after scene breaks. [Observed]
- Paragraph style: first-line indent vs. space between paragraphs. [Observed]
- Subheadings H2–H6 scale relative to body (≈1.2×, 1.15×, 1.12×, 1.09×, 1.07×). [Observed]
- **Scene break**: ornament image (preset/upload, width), blank space, or none. [Observed]
- **Notes**: end of chapter / end of book; print also supports bottom-of-page footnotes (`notesMode`, `footnoteFontSize`). [Observed]
- **Typography**: body font, size, line spacing; 1,500+ fonts (Google Fonts-scale library) with favourites; **Large Print** preset. [Observed]
- **Print**: trim size (colour-coded for KDP / IngramSpark), margins (inside > outside), justified, hyphenation, keep-with-next for scene breaks/subheadings, **layout priority** (widows & orphans / balanced spread / both). [Observed]
- **Headers/footers**: layout presets, font, size, color; auto-filled from book title/author/chapter title; hidden on chapter opening pages. [Observed]
- Full-bleed images, two-page spreads, master pages. [Observed, article titles]

### 3.4 Previewer
- Live preview for e-readers/phones/tablets (iPhone, iPad, Galaxy, Kindle Fire, Paperwhite, Oasis, Nook Glowlight, Kobo Forma) and a **print two-page spread** view. [Observed]

### 3.5 Import / export
- Import: **DOCX** (Heading 1 → chapter split, H2–H6 kept, footnotes kept). Google Docs via DOCX. [Observed]
- Export: **EPUB** (all stores), **print PDF** (no cover, cover handled separately), **DOCX** (basic formatting). [Observed]

### 3.6 Account, sync, offline
- Email/password auth with invites and password reset. [Observed]
- Autosave to cloud, offline editing, multi-device. Sync conflicts are a known support topic. [Observed]
- Paid licence check (`book-usage`, `limited-app`). [Inferred]

---

## 4. Our architecture (Next.js + Supabase)

```
┌───────────────────────────── Browser (Next.js app, installable PWA) ─────────────────────────────┐
│  UI: React + Tailwind + shadcn/ui        State: Zustand (UI) + Yjs (document content)           │
│  Editor: Plate (Slate) + slate-yjs        Offline: y-indexeddb + service worker (Serwist)       │
│  Workers: pdf.worker (react-pdf) · epub.worker (JSZip) · docx.worker (docx) · import (mammoth)  │
└──────────────┬──────────────────────────────────────────┬────────────────────────────────────────┘
               │ supabase-js (REST/RPC, auth, storage)     │ WebSocket (Yjs)
     ┌─────────▼─────────┐                       ┌─────────▼─────────┐
     │ Supabase          │                       │ Hocuspocus server │  (small Node service:
     │ Postgres + RLS    │◄──── persist Yjs ─────│ Yjs collab/sync   │   Fly.io / Railway)
     │ Auth · Storage    │      state (bytea)    │ JWT = Supabase    │
     │ Edge Functions    │                       └───────────────────┘
     └───────────────────┘
```

**Decisions and why**

| Concern | Choice | Reason |
|---|---|---|
| Editor | **TipTap (ProseMirror)**, changed from Plate on 2026-10-30 | Headless, so it works with our Base UI kit without fighting Plate's Radix-based components. It has a mature Yjs binding (`@tiptap/extension-collaboration`) for later. Atticus uses Slate/Plate. |
| Storage (personal mode) | **IndexedDB via Dexie**, with JSON backup/restore | Single-user, offline, no setup. Supabase + Yjs sync comes back when accounts are needed. |
| Content model | One **Yjs doc per chapter** | Gives offline, merge-safe sync and collaboration in one mechanism; mirrors Atticus's `/syncChapter`. |
| Sync server | **Hocuspocus** (validates Supabase JWT, stores updates in Postgres) | Supabase Realtime is not a Yjs provider. Hocuspocus is the standard, small and self-hostable. |
| Offline | y-indexeddb + Serwist service worker | Same approach as Atticus. |
| PDF | **@react-pdf/renderer in a Web Worker** | Proven by Atticus: client-side, offline, Knuth-Plass + hyphenation, custom fonts. |
| EPUB | Own XHTML templates + JSZip in a worker, EPUB 3 with EPUB 2 NCX fallback | Small and fully controllable. |
| DOCX export / import | `docx` npm / `mammoth` | Standard libs. |
| Preview | HTML/CSS renderer (same theme tokens as EPUB) inside device frames; print preview renders PDF pages from the worker | One theme definition, two renderers (HTML + react-pdf). |
| Fonts | Curated open-licence fonts (Google Fonts, OFL) in Supabase Storage/CDN, TTF for PDF embedding | react-pdf needs TTF/OTF files. |
| Payments | Stripe (one-time licence or subscription, your call) + webhook → `profiles.plan` | |

---

## 5. Data model (Supabase / Postgres)

```sql
profiles        (id uuid pk = auth.users.id, display_name, plan text, created_at)
pen_names       (id, user_id, name)

books           (id, owner_id, title, subtitle, author_name, publisher, isbn_ebook, isbn_print,
                 language, theme_id, is_boxset bool, cover_path, details jsonb, created_at, updated_at,
                 deleted_at)
boxset_books    (boxset_id, book_id, position)

chapters        (id, book_id, section text check in ('front','body','back'),
                 type text,          -- chapter|title|half-title|toc|copyrights|dedication|epigraph|
                                     -- foreword|preface|introduction|prologue|epilogue|afterword|
                                     -- acknowledgments|about-author|also-by|blurbs|endnotes|image|
                                     -- volume|part|custom|uncategorized
                 parent_id uuid null,-- volume/part grouping
                 position numeric,   -- fractional index for cheap reordering
                 title, subtitle, number_override,
                 begin_on text default 'any',   -- any|right|left
                 options jsonb,      -- hideHeading, hidePageNumber, hideHeaderFooter, hideInToc,
                                     -- hideFirstSentenceFormatting, smallTitle, invertText, imageId
                 template_id uuid null,         -- linked chapter template
                 word_count int, updated_at)
chapter_docs    (chapter_id pk, ydoc bytea, updated_at)        -- Yjs state (Hocuspocus writes)
chapter_json    (chapter_id pk, content jsonb, updated_at)     -- Slate JSON snapshot for exports/search

chapter_templates (id, user_id, type, title, ydoc bytea, content jsonb, updated_at)

themes          (id, user_id null = built-in, name, is_preset bool, config jsonb, created_at)
theme_favourites(user_id, theme_id)

images          (id, user_id, folder_id, storage_path, width, height, dpi, alt)
image_folders   (id, user_id, name, parent_id)

fonts           (id, family, variants jsonb, license, source_url)   -- global catalogue
font_favourites (user_id, font_id)

goals           (id, user_id, book_id null, kind text, target_words int, start_date, end_date,
                 days_of_week int[], completed_at)
writing_sessions(id, user_id, book_id, date, words_added int)

snapshots       (id, book_id, created_by, label, storage_path, created_at)  -- full-book JSON in Storage

book_members    (book_id, user_id, role text check in ('owner','editor','commenter','viewer'),
                 status text, invited_email, invited_at)
comments        (id, book_id, chapter_id, thread_id, author_id, body, anchor jsonb, resolved bool,
                 created_at)
-- tracked changes live inside the Yjs doc as marks (insert/delete with author + timestamp)
```

RLS: every table keyed by `book_id` checks `exists (select 1 from book_members where book_id = … and user_id = auth.uid())`, with role checks on writes.

### 5.1 Theme `config` shape (our design; field names informed by Atticus) 

```ts
type ThemeConfig = {
  typography: { bodyFont: string; fontSize: number; lineSpacing: number; largePrint: boolean };
  paragraph: { style: 'indent' | 'spaced'; indent: number; justified: boolean; hyphens: boolean };
  firstParagraph: { dropCap: boolean; dropCapFont?: string; leadInSmallCaps: 'none'|'words'|'line';
                    applyAfterSceneBreak: boolean };
  chapterHeading: {
    numberFormat: 'numeric'|'words'|'roman'|'none';
    number: TextStyle; title: TextStyle; subtitle: TextStyle;
    image?: { mode: 'none'|'same'|'perChapter'; placement: 'above'|'between'|'below'; widthPct: number };
    background?: { imageId: string; opacity: number; textColor: 'light'|'dark'; fullBleed: boolean };
    dropFromTopPct: number;
  };
  subheadings: Record<'h2'|'h3'|'h4'|'h5'|'h6', TextStyle>;
  sceneBreak: { kind: 'ornament'|'space'|'none'; imageId?: string; widthPct: number };
  notes: { mode: 'chapterEnd'|'bookEnd'|'footnotes'; footnoteFontSize: number };
  print: {
    trim: { widthIn: number; heightIn: number };       // e.g. 5x8, 5.25x8, 5.5x8.5, 6x9 ...
    margins: { top: number; bottom: number; inside: number; outside: number }; // auto from page count
    bleed: boolean; layoutPriority: 'widowsOrphans'|'balancedSpread'|'both';
    keepWithNext: { sceneBreaks: boolean; subheadings: boolean };
    header: HeaderFooterLayout; footer: HeaderFooterLayout;
  };
};
type TextStyle = { font: string; size: number; weight: number; italic: boolean;
                   smallCaps: boolean; align: 'left'|'center'|'right'; uppercase: boolean };
```

### 5.2 Editor node schema (Plate)

Blocks: `p`, `h2…h6`, `blockquote`, `verse`, `callout` (props: presetId/style), `ul/ol/li`, `img` (imageId, size, align, caption, fullPage, fullBleed), `scene-break`, `page-break`, `text-message` (sender, side), `table/tr/td/th`, `hr`.
Inlines: `link`, `endnote` (note body stored inline as children).
Marks: `bold`, `italic`, `underline`, `strikethrough`, `monospace`, `smallcaps`, `sans`, `subscript`, `superscript`.
Block props: `align`, `indent: 'none'|'hanging'|'noIndent'`.
Collab marks: `suggestion_insert` / `suggestion_delete` (author, ts), `comment_<threadId>`.

---

## 6. Export pipeline design

All exporters consume one normalized **BookModel** (book + ordered chapters as Slate JSON + resolved theme + resolved images/fonts), built in a worker from local Yjs state, so export works offline.

1. **Normalize**: resolve chapter templates, number chapters (respect volumes/parts, hidden numbers), generate TOC, collect endnotes, apply smart quotes.
2. **EPUB**: chapter → XHTML via our own templates; theme → CSS (no print-only features); `content.opf`, `nav.xhtml`, `toc.ncx`, embedded fonts (licence permitting), images; zip with `mimetype` first (stored, uncompressed). Validate with EPUBCheck in CI on sample books.
3. **Print PDF**: react-pdf document; page size = trim (+0.125in bleed when enabled); mirrored margins; running headers/footers suppressed on chapter openers; `begin_on: right` inserts blank pages; drop caps; scene-break ornaments with `wrap={false}`/minPresenceAhead for keep-with-next; footnotes via measured layout (hardest part: plan a spike); hyphenation via `hyphen` patterns per language; PDF/X-ish output (embedded fonts, 300dpi image check).
4. **DOCX**: `docx` lib, basic styles (Heading 1 per chapter, page breaks).
5. **Import DOCX**: mammoth → HTML → Slate deserializer; split at H1; map footnotes → endnote inlines; images → Storage.

Pre-export checks: unresolved comments/suggestions, low-res images, missing fonts, empty chapters.

---

## 7. Sync, offline and collaboration flow

1. Open book → load chapter list from Supabase (cached in IndexedDB for offline).
2. Open chapter → `Y.Doc` hydrates from y-indexeddb instantly, then connects to Hocuspocus (`auth: supabase access token`) and merges.
3. Hocuspocus `onStoreDocument` (debounced) writes `chapter_docs.ydoc` and a derived `chapter_json` + `word_count`.
4. Offline edits accumulate in IndexedDB and merge automatically on reconnect (CRDT, so no "sync conflict" dialogs).
5. Awareness protocol gives live cursors and collaborator presence.
6. Snapshots = serialize all chapter JSON + theme → Storage; restore creates new Y updates.

---

## 8. Build roadmap

| Phase | Deliverable |
|---|---|
| **0. Foundations** | Next.js app router, Tailwind + shadcn/ui, Supabase project, auth (email + Google), profiles, PWA shell. |
| **1. Writing MVP** | Books dashboard, book details, front/body/back chapter tree with drag-and-drop, Plate editor with marks/headings/lists/quote/verse/scene & page breaks/images/links, autosave to Supabase (`chapter_json`), word counts. |
| **2. Offline + sync** | Yjs per chapter, y-indexeddb, Hocuspocus service, service worker caching. |
| **3. Formatting** | Theme config + 4–6 original preset themes, theme builder UI, HTML previewer with device frames. |
| **4. Export** | EPUB worker → print PDF worker (trim sizes, margins, headers/footers, begin-on-right, drop caps) → DOCX. EPUBCheck in CI. |
| **5. Import** | DOCX import with chapter splitting and footnotes. |
| **6. Extras** | Endnotes/footnotes, callouts with presets, text-message element, chapter templates, volumes/parts, boxsets, goals & habit tracker, image gallery, snapshots. |
| **7. Collaboration** | Invites/roles, comments, suggestion mode, presence. |
| **8. Monetization** | Stripe checkout, plan gating, limited/trial mode. |

Biggest technical risks: (1) print layout quality in react-pdf (footnotes, widows/orphans, balanced spreads). Spike it in phase 0. (2) Font licensing for embedding: use OFL fonts only. (3) Slate + Yjs edge cases with tracked changes.

---

### 8.1 Phase 0 print spike: findings (2026-10-30)

Tested with react-pdf 4.9 in a Web Worker on a 4-chapter sample book (`/spike/print`, `npm run check:print`).

| Area | Result |
|---|---|
| Speed | 14–16 pages in about 0.6–1.2 s including 1–2 extra layout passes. Fine for live preview, but long books will need per-chapter caching. |
| Runs offline in a worker | Yes. Fonts are fetched from the app origin. |
| Trim sizes | 5×8, 5.25×8, 5.5×8.5, 6×9 all pass the checks. |
| Mirrored margins | **Not native.** react-pdf applies one padding to every page of a wrapping `<Page>`. Fixed by laying out with the gutter on the right, then shifting recto pages with `pdf-lib` `translateContent`. Verified from text positions. |
| Chapters begin on right | Works with a measure pass: a hidden render-prop probe reports each chapter's page count, then blank versos are inserted and the book is laid out again. |
| Gutter by page count | The gutter grows with page count, which changes text width, so layout re-measures until stable (at most 3 passes). |
| Running heads / folios | Work through `fixed` render-prop text, hidden on chapter openers via `subPageNumber`. **Gotcha:** a folio anchored with `bottom` never rendered; anchor from `top` instead. |
| Widows/orphans, hyphenation | Native `widows`/`orphans` props. Hyphenation can be turned off per paragraph with `hyphenationCallback`. |
| Drop caps | **Not native** (no float). A large inline initial made line 2 overlap line 1 until the initial got `lineHeight: 1`. The first line is still tighter than the rest. A true 3-line drop cap needs our own line measuring (fontkit) to split the first lines into a row next to the initial. Treat as Phase 4 work. |
| Small caps | No OpenType `smcp` feature access seen. Faked with uppercase at a smaller size. Real small caps need a small-caps font cut or our own glyph substitution. |
| Still untested | Footnotes at the bottom of the page, balanced spreads, full-bleed images, PDF/X output. |

## 9. Open questions / unknowns

- Exact UI layout and flows behind login (not observed; we design our own).
- Full trim-size list and default margin table (published by KDP/IngramSpark; take from their docs).
- Purpose of the AWS API Gateway WebSocket (likely notifications).
- How Atticus implements footnotes and balanced spreads inside react-pdf.
- Whether to sell one-time or subscription (product decision).

## 10. Sources
- https://www.atticus.io/ , /support/ , /tutorials/
- Intercom help center: https://intercom.help/atticus-5877e36564df/en (custom theme, text & paragraph styling, export file types, trim size, collaboration articles)
- app.atticus.io public files: `manifest.json`, `asset-manifest.json`, `service-worker.js`, `static/js/*.chunk.js` + `.LICENSE.txt`
