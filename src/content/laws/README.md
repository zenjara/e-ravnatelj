# Law texts (propisi)

This folder holds the **full plain text** of the Croatian education law(s) and
regulations that the AI answers from. There is **no database / RAG** — on each
question the `/api/ask` route prepends the text in these files as context.

## How to add the real text

1. Drop the full text into the `.md` files here (one file per propis), replacing
   the placeholder content.
2. Keep the article markers (`Članak N`) intact — the model cites them and the
   UI surfaces them.
3. No code change needed: the loader (added in the AI-layer step) reads every
   file in this folder and concatenates them.

## Files

- `zakon-oosos.md` — Zakon o odgoju i obrazovanju u osnovnoj i srednjoj školi.
- Add more pravilnici as separate `.md` files as needed.
