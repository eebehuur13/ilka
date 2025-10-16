# Ilka - Advanced Knowledge Platform

Ilka is a sophisticated RAG (Retrieval-Augmented Generation) system with 4 distinct retrieval methods, AGR (Agentic Graph Reasoning), and intelligent routing.

## Architecture

### Core Components

1. **Document Processing Pipeline**
   - Multi-signal heading detection (ALL_CAPS, numbered, title case, etc.)
   - Hierarchical chunking with 5000 token limit
   - Section-based context preservation
   - Automatic BM25 indexing

2. **Contextual Enrichment**
   - Document summarization (500-1000 words)
   - Keyword extraction (15-20 terms)
   - Batched context generation (20 chunks per LLM call)
   - Full embedding with Cloudflare Vectorize

3. **Query Processing**
   - Single LLM query analysis (classification, expansion, HyDE, routing)
   - Smart router (decides which methods to run)
   - Query preprocessing (fuzzy matching, synonym expansion)

4. **Retrieval Methods**
   - **Method 1**: BM25 Direct (1.5-2s latency)
   - **Method 2**: BM25 + Agents (3-4s latency, AGR widening)
   - **Method 3**: Vector + Agents (4-5s latency)
   - **Method 4**: HyDE + Agents (5-6s latency)

5. **AGR Agents**
   - **Supervisor**: Decides if widening is needed
   - **Context-Maker**: Executes widening strategies (heading-bounded, sliding-window)
   - **Writer**: Generates answers with citations
   - **Verifier**: Checks answer quality, triggers re-widening if needed

### BM25 Configuration

- k1 = 1.5
- b = 0.4
- Rare term IDF threshold = 4.0
- Rare term boost = 1.5x
- Position-based scoring (heading = 1.5x, body = 1.0x)

## Setup

```bash
# Install dependencies
npm install

# Create D1 database
npm run db:create

# Update wrangler.toml with your database_id

# Run migrations locally
npm run db:migrate

# Deploy migrations to production
npm run db:migrate:remote

# Start local dev server
npm run dev

# Deploy to production
npm run deploy
```

## API Endpoints

### 1. Upload Document

```bash
POST /upload

Body:
{
  "file_name": "document.txt",
  "content": "Full text content...",
  "user_id": "user-123"
}

Response:
{
  "document_id": "uuid",
  "status": "processing",
  "message": "Document uploaded successfully..."
}
```

### 2. Query

```bash
POST /query

Body:
{
  "query": "What are the teacher training requirements?",
  "user_id": "user-123",
  "methods": ["bm25", "vector"]  // optional
}

Response:
{
  "query": "...",
  "analysis": {
    "intent": "factual",
    "complexity": "moderate",
    "synonyms": [...],
    "hypothetical_answer": "...",
    ...
  },
  "answers": [
    {
      "method": "method1-bm25-direct",
      "text": "Answer with [1] citations [2]...",
      "citations": [...],
      "confidence": "high",
      "latency_ms": 1650
    },
    {
      "method": "method2-bm25-agents",
      "text": "...",
      "latency_ms": 3800
    }
  ],
  "total_latency_ms": 3850
}
```

### 3. List Documents

```bash
GET /documents?user_id=user-123

Response:
{
  "documents": [
    {
      "id": "uuid",
      "file_name": "document.txt",
      "status": "ready",
      "chunk_count": 187,
      "upload_date": 1234567890
    }
  ]
}
```

### 4. Get Status

```bash
GET /status/:document_id

Response:
{
  "id": "uuid",
  "file_name": "document.txt",
  "status": "ready",
  "chunk_count": 187
}
```

### 5. Delete Document

```bash
DELETE /documents/:id?user_id=user-123

Response:
{
  "message": "Document deleted successfully"
}
```

## Document Processing Stages

1. **uploading** → Document stored in R2
2. **processing** → Text extracted (if needed)
3. **chunking** → Hierarchical chunking with heading detection
4. **indexing_bm25** → BM25 inverted index built
5. **generating_summary** → Document summarized + keywords extracted
6. **generating_contexts** → Batched context generation for all chunks
7. **embedding** → Chunks embedded and stored in Vectorize
8. **ready** → All processing complete

Total time: ~15-20 seconds for a 100-page document

## Retrieval Strategy

### Simple Query → Method 1 Only
- Fast response (1.5-2s)
- BM25 keyword matching
- Embedding reranking

### Moderate Query → Method 1 + Method 2
- Fast answer shown immediately
- Deep answer with AGR widening follows

### Complex Query → All Methods
- Method 1, 2, 3, 4 run in parallel
- User sees progressive results
- Best answer marked automatically

## AGR Widening Strategies

1. **heading-bounded**: Expand to full section under same heading
2. **sliding-window**: Include neighboring passages (±1)
3. **full-section**: Expand to entire top-level section
4. **multi-section**: Expand across related sections

Widening triggered when:
- Passage count < 5
- Top score < 3.0
- Verifier finds low citation rate

## Development

### Project Structure

```
src/
├── types.ts                 # TypeScript interfaces
├── utils/
│   ├── tokenizer.ts        # Token counting
│   ├── heading-detector.ts # Multi-signal heading detection
│   └── chunker.ts          # Hierarchical chunking
├── retrieval/
│   ├── bm25.ts             # BM25 indexer + searcher
│   ├── vector.ts           # Vectorize integration
│   └── reranker.ts         # Multi-stage reranking
├── processing/
│   ├── document-processor.ts
│   ├── summarizer.ts
│   ├── context-enricher.ts
│   └── embedder.ts
├── query/
│   ├── analyzer.ts         # Single LLM query analysis
│   └── router.ts           # Method routing
├── agents/
│   ├── supervisor.ts
│   ├── context-maker.ts
│   ├── writer.ts
│   └── verifier.ts
├── methods/
│   ├── method1-bm25-direct.ts
│   ├── method2-bm25-agents.ts
│   ├── method3-vector-agents.ts
│   └── method4-hyde-agents.ts
├── api/
│   └── handlers.ts
├── queue-consumer.ts
└── index.ts
```

## Testing

Upload the NEP document:

```bash
curl -X POST http://localhost:8787/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "NEP_Final_English_0.txt",
    "content": "...",
    "user_id": "test-user"
  }'
```

Check status:

```bash
curl http://localhost:8787/status/DOCUMENT_ID
```

Query:

```bash
curl -X POST http://localhost:8787/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the teacher training requirements in NEP 2020?",
    "user_id": "test-user"
  }'
```

## Performance Targets

- **Upload**: < 2s (sync)
- **Processing**: ~15-20s (async)
- **Method 1**: 1.5-2s
- **Method 2**: 3-4s
- **Method 3**: 4-5s
- **Method 4**: 5-6s

## Future Enhancements

- [ ] PDF parsing with Docling
- [ ] Cross-encoder reranking (final polish)
- [ ] Feedback loop (track clicks, learn relevance)
- [ ] Chat mode (model-only with web search)
- [ ] Multi-document queries
- [ ] Real-time streaming responses
