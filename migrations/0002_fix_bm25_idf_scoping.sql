-- Fix BM25 IDF scoping: Scope IDF per document instead of globally
-- This prevents IDF scores from being overwritten when indexing new documents

-- Drop old table and recreate with proper scoping
DROP TABLE IF EXISTS bm25_idf;

CREATE TABLE IF NOT EXISTS bm25_idf (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_frequency INTEGER NOT NULL,
  idf_score REAL NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(term, document_id)
);

CREATE INDEX idx_bm25_idf_term_doc ON bm25_idf(term, document_id);
CREATE INDEX idx_bm25_idf_document ON bm25_idf(document_id);
