-- Fix cross-document ranking: Scope IDF by user_id instead of document_id
-- This enables fair BM25 score comparison across all documents in a user's corpus

-- Drop and recreate bm25_idf with user_id scoping
DROP TABLE IF EXISTS bm25_idf;

CREATE TABLE IF NOT EXISTS bm25_idf (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  user_id TEXT NOT NULL,
  document_frequency INTEGER NOT NULL,
  idf_score REAL NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(term, user_id)
);

CREATE INDEX idx_bm25_idf_term_user ON bm25_idf(term, user_id);
CREATE INDEX idx_bm25_idf_user ON bm25_idf(user_id);

-- Add user-level corpus statistics table
CREATE TABLE IF NOT EXISTS bm25_user_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  total_documents INTEGER NOT NULL DEFAULT 0,
  total_passages INTEGER NOT NULL DEFAULT 0,
  avg_passage_length REAL NOT NULL DEFAULT 0,
  total_terms INTEGER NOT NULL DEFAULT 0,
  unique_terms INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_bm25_user_stats_user ON bm25_user_stats(user_id);
