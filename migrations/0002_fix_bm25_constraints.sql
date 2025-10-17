-- Migration 0002: Fix BM25 table constraints to prevent duplicate insertions
-- and add user_id column to bm25_idf for proper user-scoped IDF calculation

-- Drop old tables (can't easily add composite unique constraints to existing tables)
DROP TABLE IF EXISTS bm25_terms;
DROP TABLE IF EXISTS bm25_idf;
DROP TABLE IF EXISTS bm25_stats;

-- BM25 terms table: inverted index for term frequencies
-- Fixed: Added composite PRIMARY KEY to prevent duplicates
CREATE TABLE bm25_terms (
  term TEXT NOT NULL,
  document_id TEXT NOT NULL,
  passage_id TEXT NOT NULL,
  term_frequency INTEGER NOT NULL,
  position_weight REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (term, document_id, passage_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE
);

CREATE INDEX idx_bm25_terms_term ON bm25_terms(term);
CREATE INDEX idx_bm25_terms_document ON bm25_terms(document_id);
CREATE INDEX idx_bm25_terms_passage ON bm25_terms(passage_id);

-- BM25 IDF table: inverse document frequency scores
-- Fixed: Added user_id column and composite PRIMARY KEY for user-scoped IDF
CREATE TABLE bm25_idf (
  term TEXT NOT NULL,
  user_id TEXT NOT NULL,
  document_frequency INTEGER NOT NULL,
  idf_score REAL NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (term, user_id)
);

CREATE INDEX idx_bm25_idf_term ON bm25_idf(term);
CREATE INDEX idx_bm25_idf_user ON bm25_idf(user_id);

-- BM25 stats table: document statistics for scoring
-- Fixed: Changed document_id to PRIMARY KEY to prevent duplicates
CREATE TABLE bm25_stats (
  document_id TEXT NOT NULL PRIMARY KEY,
  total_passages INTEGER NOT NULL,
  avg_passage_length REAL NOT NULL,
  total_terms INTEGER NOT NULL,
  unique_terms INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_bm25_stats_document ON bm25_stats(document_id);
