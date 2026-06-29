# Law texts (propisi)

This folder is the **initial seed** for the law corpus. The runtime source of
truth is the Supabase `laws` table (editable via the admin UI); these files are
loaded into it. From there each law is chunked per article (članak), embedded,
and stored in `law_chunks`. At question time `/api/ask` retrieves the most
relevant articles — nothing is read from this folder at runtime.

## How to add / update / remove a law

1. Add/edit/rename/delete `.md` or `.txt` files here (one file per propis; the
   filename becomes the title + slug). `README.md` and files starting with `_`
   are ignored.
2. Keep the article markers (`Članak N`) intact — chunking splits on them, and
   the model cites them.
3. Sync the DB to match this folder:
   ```
   npm run sync:laws
   ```
   This upserts current files into the `laws` table, **removes** laws whose file
   was deleted/renamed (and their chunks), and **re-embeds only changed/new**
   laws (unchanged ones are skipped — no cost). Use this for everyday changes.

   (`npm run seed:laws` + `npm run ingest` still exist for the first bulk load;
   `ingest` is resumable but only ADDS — it won't clean up deletions/renames.)

## If the source is a PDF or .doc/.docx

Convert it to text first (the loader reads text, not binary formats):
- PDF with a text layer → `pdftotext`/`pdfplumber`; scanned PDF → OCR (e.g.
  tesseract `-l hrv`).
- `.doc`/`.docx` → `textutil -convert txt -encoding UTF-8 file.docx`.

Verify the result preserved Croatian diacritics and the `Članak N` structure
before ingesting.
