# Echo

Echo is a local desktop search engine built with Electron, React, TypeScript, Vite, Tailwind CSS, Zustand, and SQLite.

It indexes your files and lets you search them instantly. Echo owns its entire search stack: positional inverted index, trie-based autocomplete, BM25 ranking, phrase search, prefix search, fuzzy search, and highlighted snippets.

## Features

- Persistent SQLite-backed search index
- Add, remove, enable, and disable indexed folders
- Recursive indexing of `.txt`, `.md`, `.pdf`, `.docx`, and `.html`
- Index lifecycle management: create, load, rebuild, delete
- Trie-based autocomplete
- BM25 ranking with phrase-match boosting
- Phrase, prefix, and fuzzy (Levenshtein) search
- Live search results with highlighted snippets
- Open files with the default OS application
- Index statistics and status panel
- Clean Lucide icon set
- Cmd/Ctrl + K keyboard shortcut to focus search
- System-aware light/dark theme

## Project structure

```
src/
  electron/        # Electron main process
  database/        # SQLite schema and repositories
  indexer/         # File crawler, extractors, tokenizer, IndexManager
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
# Install dependencies and rebuild native modules for Electron
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

## Current scope

This release focuses on persistent, daily-use search:

- SQLite is the source of truth for the index
- Launch loads the existing index instantly — no automatic rebuild
- Explicit index management: create, rebuild, delete
- Folder management with persistence
- Index statistics and status
- Professional, native-feeling desktop UI

File watchers, background indexing, incremental indexing, search history, analytics, cloud sync, authentication, and AI features are intentionally excluded but the architecture is designed to support them later.
