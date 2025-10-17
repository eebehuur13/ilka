export type DocumentStatus = 
  | 'uploading'
  | 'processing'
  | 'chunking'
  | 'indexing_bm25'
  | 'generating_summary'
  | 'generating_contexts'
  | 'embedding'
  | 'ready'
  | 'error'

export interface Document {
  id: string
  file_name: string
  status: DocumentStatus
  chunk_count?: number
  file_size: number
  upload_date: number
  error_message?: string
  progress?: number
}

export type ChatMode = 'model-only' | 'file-search'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  method?: MethodResult[]
  allAnswers?: MethodResult[]
  analysis?: QueryAnalysis
  thinking?: string
  isStreaming?: boolean
}

export interface QueryAnalysis {
  complexity: 'simple' | 'moderate' | 'complex'
  intent: 'factual' | 'analytical' | 'comparison' | 'summary'
  target_type?: string
  synonyms?: string[]
  related_terms?: string[]
  recommended_methods?: RetrievalMethod[]
}

export interface MethodResult {
  method: string
  label: string
  latency_ms: number
  answer: string
  citations?: Citation[]
  confidence?: 'high' | 'medium' | 'low'
  status: 'pending' | 'streaming' | 'complete'
}

export interface Citation {
  file_name: string
  start_line: number
  end_line: number
  text: string
}

export type RetrievalMethod = 'bm25' | 'vector' | 'hyde' | 'all'

export interface QueryOptions {
  methods?: RetrievalMethod[]
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: Date
  updated_at: Date
}
