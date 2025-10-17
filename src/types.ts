// Core environment bindings
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  VECTORIZE: VectorizeIndex;
  QUEUE: Queue;
  AI: Ai;
  OPENAI_API_KEY: string;
}

// Document types
export interface Document {
  id: string;
  file_name: string;
  file_type: string;
  user_id: string;
  upload_date: number;
  status: DocumentStatus;
  chunk_count: number | null;
  file_size: number | null;
  full_text: string | null;
  created_at: number;
  updated_at: number;
}

export type DocumentStatus = 
  | 'uploading'
  | 'processing'
  | 'chunking'
  | 'indexing_bm25'
  | 'generating_summary'
  | 'generating_contexts'
  | 'embedding'
  | 'ready'
  | 'error';

// Passage (chunk) types
export interface Passage {
  id: string;
  document_id: string;
  passage_index: number;
  start_line: number;
  end_line: number;
  heading: string | null;
  heading_level: number | null;
  parent_section_id: string | null;
  text: string;
  word_count: number;
  token_count: number;
  created_at: number;
  file_name?: string;
}

export interface ScoredPassage extends Passage {
  score: number;
  method?: string;
}

// Heading detection types
export interface HeadingSignals {
  all_caps: boolean;
  numbered: boolean;
  title_case: boolean;
  short_length: boolean;
  followed_by_blank: boolean;
  colon_ended: boolean;
  contains_section_marker: boolean;
}

export interface DetectedHeading {
  text: string;
  line_number: number;
  level: number;
  score: number;
  signals: HeadingSignals;
}

// Chunking types
export interface ChunkBoundary {
  start_line: number;
  end_line: number;
  heading: string | null;
  heading_level: number | null;
  parent_section_id: string | null;
  text: string;
  word_count: number;
  token_count: number;
}

// Section types
export interface Section {
  id: string;
  document_id: string;
  heading: string;
  heading_level: number;
  parent_section_id: string | null;
  start_passage_index: number;
  end_passage_index: number;
  passage_count: number;
}

// Query analysis types
export interface QueryAnalysis {
  intent: 'factual' | 'exploratory' | 'analytical' | 'summary' | 'comparison';
  complexity: 'simple' | 'moderate' | 'complex';
  target_type: 'general' | 'specific_doc' | 'multi_doc';
  target_document: string | null;
  synonyms: string[];
  related_terms: string[];
  rephrasings: string[];
  hypothetical_answer: string;
  recommended_methods: RetrievalMethod[];
  reasoning: string;
  sub_questions: string[] | null;
}

export type RetrievalMethod = 'bm25' | 'vector' | 'hyde' | 'summary';

// Retrieval result types
export interface RetrievalResult {
  method: string;
  passages: ScoredPassage[];
  latency_ms: number;
  metadata?: any;
}

// Answer types
export interface Answer {
  method: string;
  text: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  latency_ms: number;
  metadata?: any;
}

export interface Citation {
  file_name: string;
  start_line: number;
  end_line: number;
  text: string;
}

// Agent types
export interface AgentDecision {
  action: 'proceed' | 'widen' | 'requery';
  strategy?: WideningStrategy;
  reasoning: string;
}

export type WideningStrategy = 
  | 'heading-bounded'
  | 'sliding-window'
  | 'full-section'
  | 'multi-section';

// Queue message types
export interface QueueMessage {
  type: QueueMessageType;
  document_id: string;
  user_id: string;
  metadata?: any;
}

export type QueueMessageType =
  | 'process_document'
  | 'generate_summary'
  | 'generate_contexts'
  | 'generate_embeddings'
  | 'index_bm25';

// Context enrichment types
export interface ContextBatch {
  chunks: Array<{
    passage_id: string;
    text_preview: string;
  }>;
  document_summary: string;
  document_name: string;
}

export interface GeneratedContext {
  passage_id: string;
  context: string;
}

// BM25 types
export interface BM25Params {
  k1: number;
  b: number;
  rare_term_idf_threshold: number;
  rare_term_boost: number;
}

// Vector search types
export interface VectorSearchOptions {
  top_k: number;
  namespace?: string;
  filter?: any;
}

// API request/response types
export interface UploadRequest {
  file_name: string;
  content: string;
  user_id: string;
}

export interface QueryRequest {
  query: string;
  user_id: string;
  methods?: RetrievalMethod[];
  options?: {
    top_k?: number;
    temperature?: number;
  };
}

export interface QueryResponse {
  query: string;
  analysis: QueryAnalysis;
  answers: Answer[];
  total_latency_ms: number;
}
