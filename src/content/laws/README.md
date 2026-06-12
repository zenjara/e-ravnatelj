# Law texts (propisi)

This folder holds the **full plain text** of the Croatian education law(s) and
regulations that the AI answers from. There is **no database / RAG** — on each
question the `/api/ask` route prepends the text in these files as context.

## How to add the real text

1. Drop the full text into a `.md` (or `.txt`) file here (one file per propis),
   replacing the placeholder content.
2. Keep the article markers (`Članak N`) intact — the model cites them and the
   UI surfaces them.
3. No code change needed: `index.ts` reads every `.md`/`.txt` file in this folder
   (except `README.md` and files starting with `_`) and concatenates them.

## If the source is a PDF

The loader reads plain text, not PDFs (the corpus is static, so there's no
reason to parse a PDF on every request). Convert the PDF to text once and save
it as a `.md` here. Verify the extraction preserved Croatian diacritics and the
`Članak N` structure before relying on it.

## Files

- `zakon-oosos.md` — Zakon o odgoju i obrazovanju u osnovnoj i srednjoj školi.
- Add more pravilnici as separate `.md` files as needed.
