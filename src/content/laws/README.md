# Law texts (propisi)

This folder holds the **plain text** of the Croatian laws and regulations the AI
answers from. These files are the **source corpus** for retrieval (RAG): they are
chunked per article (članak), embedded, and stored in Supabase (`law_chunks`).
At question time `/api/ask` retrieves the most relevant articles — it does NOT
read these files at runtime.

## How to add / update a law

1. Drop the full text into a `.md` or `.txt` file here (one file per propis),
   `README.md` and files starting with `_` are ignored.
2. Keep the article markers (`Članak N`) intact — chunking splits on them, and
   the model cites them.
3. Re-run ingestion to (re)build the vector store:
   ```
   npm run ingest        # requires 0002_law_chunks.sql applied in Supabase
   ```

## If the source is a PDF or .doc/.docx

Convert it to text first (the loader reads text, not binary formats):
- PDF with a text layer → `pdftotext`/`pdfplumber`; scanned PDF → OCR (e.g.
  tesseract `-l hrv`).
- `.doc`/`.docx` → `textutil -convert txt -encoding UTF-8 file.docx`.

Verify the result preserved Croatian diacritics and the `Članak N` structure
before ingesting.
