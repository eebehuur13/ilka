-- Documents table: stores uploaded files metadata
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  upload_date INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  chunk_count INTEGER,
  full_text TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);

-- Document summaries table
CREATE TABLE IF NOT EXISTS document_summaries (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_summaries_document_id ON document_summaries(document_id);

-- Document keywords table
CREATE TABLE IF NOT EXISTS document_keywords (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  keywords TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_keywords_document_id ON document_keywords(document_id);

-- Passages table: stores document chunks
CREATE TABLE IF NOT EXISTS passages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  passage_index INTEGER NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  heading TEXT,
  heading_level INTEGER,
  parent_section_id TEXT,
  text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_passages_document_id ON passages(document_id);
CREATE INDEX idx_passages_heading ON passages(heading);
CREATE INDEX idx_passages_parent_section ON passages(parent_section_id);

-- Chunk contexts table: stores LLM-generated contextual descriptions
CREATE TABLE IF NOT EXISTS chunk_contexts (
  id TEXT PRIMARY KEY,
  passage_id TEXT NOT NULL,
  context_text TEXT NOT NULL,
  contextualized_text TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE
);

CREATE INDEX idx_contexts_passage_id ON chunk_contexts(passage_id);

-- BM25 terms table: inverted index for term frequencies
CREATE TABLE IF NOT EXISTS bm25_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  document_id TEXT NOT NULL,
  passage_id TEXT NOT NULL,
  term_frequency INTEGER NOT NULL,
  position_weight REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE
);

CREATE INDEX idx_bm25_terms_term ON bm25_terms(term);
CREATE INDEX idx_bm25_terms_document ON bm25_terms(document_id);
CREATE INDEX idx_bm25_terms_passage ON bm25_terms(passage_id);

-- BM25 IDF table: inverse document frequency scores
CREATE TABLE IF NOT EXISTS bm25_idf (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,
  document_frequency INTEGER NOT NULL,
  idf_score REAL NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_bm25_idf_term ON bm25_idf(term);

-- BM25 stats table: document statistics for scoring
CREATE TABLE IF NOT EXISTS bm25_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  total_passages INTEGER NOT NULL,
  avg_passage_length REAL NOT NULL,
  total_terms INTEGER NOT NULL,
  unique_terms INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_bm25_stats_document ON bm25_stats(document_id);

-- Section boundaries table: stores heading hierarchy
CREATE TABLE IF NOT EXISTS section_boundaries (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  heading TEXT NOT NULL,
  heading_level INTEGER NOT NULL,
  parent_section_id TEXT,
  start_passage_index INTEGER NOT NULL,
  end_passage_index INTEGER NOT NULL,
  passage_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_sections_document_id ON section_boundaries(document_id);
CREATE INDEX idx_sections_parent ON section_boundaries(parent_section_id);
