# Folio (working name)

A book writing and formatting app for authors: write chapters, design the interior, export EPUB and print-ready PDF.
Built with Next.js 16 (App Router, Cache Components), Supabase, Tailwind 4 and shadcn/ui (Base UI).

Product research and the full build plan: [docs/atticus-teardown-spec.md](docs/atticus-teardown-spec.md).
To rename the app, change `src/config/site.ts`.

## Getting started

```bash
npm install
npm run dev        # or: npm run build && npm run start
```

Open http://localhost:3000. It opens straight onto your bookshelf, with no account needed.

### Where your writing is stored

The app currently runs in **personal, local-only mode**:

- Books and chapters are saved in this browser's IndexedDB as you type (Ctrl/Cmd+S saves instantly). They work offline.
- Data belongs to this browser profile on this computer. Clearing site data, or using another browser, means you won't see it.
- **Back up regularly**: "Back up all" on the bookshelf, or the download icon in the editor, saves a `.json` file. "Restore" loads it back as a copy. It never overwrites existing books.

### Writing features

- Bookshelf with word counts; book details (title, subtitle, author).
- Front matter, chapters and back matter, with typed sections (dedication, prologue, acknowledgments…), reorder, delete.
- Editor: headings, bold/italic/underline/strike, links, quotes, lists, alignment, scene breaks, undo/redo.
  Smart quotes, em dashes and ellipses are applied as you type. Book-style first-line indents.
- Autosave with status, per-chapter and whole-book word counts, focus mode, light/dark theme.
- Grammarly is disabled inside the editor, because it rewrites the editor's text and causes glitches.

### Exporting (Export button in the editor)

- **EPUB 3** for Kindle (KDP), Apple Books, Kobo and Google Play, with an EPUB 2 NCX for older readers.
  Built in the browser from `src/lib/epub/build-epub.ts`.
- **Print-ready PDF** for KDP Print and IngramSpark, with a live preview. It has:
  - trim sizes, font size, line spacing, justification and hyphenation
  - lines kept together at page breaks (widows and orphans)
  - a large first letter in chapters
  - chapters starting on right-hand pages, with blank pages inserted automatically
  - a table of contents with real page numbers
  - mirrored gutter margins, running heads and page numbers

  The layout runs in a Web Worker (`src/lib/print/`).
- Both are generated from one shared book model (`src/lib/publish/model.ts`), so they always contain the same text.
- Reading order: title page, copyright page (yours if you wrote a Copyright section), dedication/epigraph, contents, then the rest.
- Not included yet: covers, images, footnotes.

### Supabase setup (later, for cloud sync)

Sign-in code is in place but switched off (`PROTECTED_PREFIXES` in `src/lib/supabase/proxy.ts`).

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **Project Settings → API**: copy the project URL and the publishable key into `.env.local`.
3. **SQL Editor**: run [`supabase/migrations/20261030000000_profiles.sql`](supabase/migrations/20261030000000_profiles.sql)
   (or `npx supabase db push` once the project is linked with `npx supabase link`).
4. **Authentication → URL Configuration**: set the Site URL to `http://localhost:3000` and add
   `http://localhost:3000/auth/callback` to the redirect URLs (plus your production URL later).
5. **Authentication → Providers → Google** (optional): add a Google OAuth client ID and secret.
   In Google Cloud, the authorised redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` / `npm run start` | Production build / server (the service worker only registers in production) |
| `npm run lint` | ESLint |
| `npm run check:print` | Renders the sample book through the print pipeline and checks layout rules (right-hand starts, contents page numbers, mirrored margins, running heads). Needs the app running on :3000 (fonts load from it). Options: `TRIM=6x9 FONT_SIZE=12`. |
| `npm run check:epub` | Builds the sample EPUB and checks its structure. Set `EPUBCHECK_JAR` to also run the official W3C EPUBCheck (needs Java). |

## Project layout

```
src/
  app/
    (auth)/        login, signup (unused in local-only mode)
    (app)/         bookshelf
    auth/callback  OAuth + email-confirmation code exchange
    write/[bookId]  writing workspace (chapters + editor)
    export/[bookId] EPUB and print PDF export with live preview
    icons/[size]   generated PWA icons
    manifest.ts    web app manifest
  lib/
    supabase/      browser/server clients, session-refreshing proxy helper
    library/       IndexedDB storage (Dexie), backups
    publish/       shared book model built from editor content
    print/         react-pdf book layout, worker, trim sizes and margins
    epub/          EPUB 3 builder
  proxy.ts         Next 16 proxy (formerly middleware): session refresh + route guard
supabase/migrations  SQL migrations
public/sw.js         service worker (network-first, offline fallback)
public/fonts         OFL-licensed fonts embedded into PDFs
```
