# Echo

Echo is a desktop search engine built with Electron, React, TypeScript, Vite, Tailwind CSS, Zustand, and SQLite.

It indexes your local files and lets you search them instantly. Echo owns its search stack: positional inverted index, trie-based autocomplete, BM25 ranking, phrase search, prefix search, fuzzy search, and highlighted snippets.

## Features

- Index local folders recursively
- Extract text from `.txt`, `.md`, `.pdf`, `.docx`, and `.html`
- SQLite-backed positional inverted index
- Trie-based autocomplete
- BM25 ranking with phrase-match boosting
- Phrase, prefix, and fuzzy (Levenshtein) search
- Live search results with highlighted snippets
- Open files with the default OS application

## Project structure

```
src/
  electron/        # Electron main process
  database/        # SQLite schema and repositories
  indexer/         # File crawler, extractors, tokenizer, indexer
  search/          # Search engine: trie, BM25, phrase/prefix/fuzzy search
  file-extractors/ # Text extraction for supported formats
  ipc/             # IPC channel constants
  renderer/        # React UI
    pages/
    components/
    stores/
```

## Scripts

```bash
# Install dependencies and rebuild native modules
npm install

# Run the app in development mode
npm run dev

# Build for production
npm run build
npm run transpile:electron

# Run tests
npm run test:unit
npm run test:e2e

# Rebuild native modules manually (if needed)
npm run rebuild:native
```

## Milestone 1 scope

This release focuses on the core search experience:

- Folder management and manual indexing
- Recursive indexing of supported file types
- Positional inverted index in SQLite
- Trie, BM25, phrase, prefix, and fuzzy search
- Search-first UI with autocomplete and snippets

File watchers, background indexing, incremental indexing, search history, analytics, cloud sync, authentication, and AI features are intentionally excluded for Milestone 1 but the architecture is designed to support them later.
