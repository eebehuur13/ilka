# Ilka Architecture

## System Overview

Ilka is a complete knowledge platform built on Cloudflare Workers with 4 distinct retrieval methods, AGR (Agentic Graph Reasoning), and intelligent routing.

## Full Component Breakdown

### 1. Document Ingestion Pipeline

```
User uploads .txt file
       ↓
Store in R2 bucket
       ↓
Save metadata in D1
       ↓
Queue: process_document
       ↓
┌──────────────────────────────────────┐
│  ASYNC PROCESSING                    │
├──────────────────────────────────────┤
│                                      │
│  1. Chunking (1-2s)                  │
│     ├─ Multi-signal heading detect   │
│     ├─ Hierarchical chunking         │
│     └─ 5000 token limit per chunk    │
│                                      │
│  2. BM25 Indexing (1-2s)             │
│     ├─ Tokenization                  │
│     ├─ Term frequency calculation    │
│     ├─ IDF computation               │
│     └─ Position-based weighting      │
│                                      │
│  3. Summarization (2-3s)             │
│     ├─ LLM generates summary         │
│     └─ Extract 15-20 keywords        │
│                                      │
│  4. Context Enrichment (4-5s)        │
│     ├─ Batch chunks (20 per call)    │
│     ├─ LLM generates contexts        │
│     └─ Store contextualized text     │
│                                      │
│  5. Embedding (5-6s)                 │
│     ├─ Embed contextualized chunks   │
│     ├─ Store in Vectorize            │
│     └─ Update status: 'ready'        │
│                                      │
│  Total: ~15-20 seconds               │
└──────────────────────────────────────┘
```

### 2. Query Processing Flow

```
User query arrives
       ↓
┌──────────────────────────────────────┐
│  QUERY ANALYSIS (Single LLM call)    │
├──────────────────────────────────────┤
│  ├─ Classification                   │
│  │   └─ intent, complexity, target   │
│  ├─ Expansion                        │
│  │   └─ synonyms, related terms      │
│  ├─ Rephrasings                      │
│  │   └─ 3 alternative phrasings      │
│  ├─ HyDE                             │
│  │   └─ hypothetical answer          │
│  └─ Routing recommendation           │
│      └─ which methods to use         │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  ROUTER DECISION                     │
├──────────────────────────────────────┤
│  Simple + Factual → Method 1 only    │
│  Moderate → Method 1 + 2 (parallel)  │
│  Complex → All methods (parallel)    │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────────────────┐
│  PARALLEL EXECUTION                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Method 1: BM25 Direct          Method 2: BM25 + Agents │
│  ┌─────────────────────┐        ┌──────────────────────┐│
│  │ BM25 search         │        │ BM25 search          ││
│  │ Embedding rerank    │        │ Supervisor decision  ││
│  │ LLM answer          │        │ Context widening     ││
│  │ ~1.8s              │        │ Writer + Verifier    ││
│  └─────────────────────┘        │ ~3.5s               ││
│                                 └──────────────────────┘│
│                                                          │
│  Method 3: Vector + Agents      Method 4: HyDE + Agents│
│  ┌─────────────────────┐        ┌──────────────────────┐│
│  │ Vector search       │        │ Generate HyDE doc    ││
│  │ Supervisor decision │        │ Vector search        ││
│  │ Context widening    │        │ Supervisor + widening││
│  │ Writer + Verifier   │        │ Writer + Verifier    ││
│  │ ~4.2s              │        │ ~5.5s               ││
│  └─────────────────────┘        └──────────────────────┘│
└──────────────────────────────────────────────────────────┘
       ↓
Return all answers to user
```

### 3. AGR Agent Flow (Methods 2, 3, 4)

```
Initial retrieval (BM25/Vector/HyDE)
       ↓
┌──────────────────────────────────────┐
│  SUPERVISOR AGENT                    │
├──────────────────────────────────────┤
│  Analyzes retrieval quality:         │
│  ├─ Passage count >= 10?             │
│  ├─ Top score > 5.0?                 │
│  └─ Decision: proceed/widen/requery  │
└──────────────────────────────────────┘
       ↓
    (if widen)
       ↓
┌──────────────────────────────────────┐
│  CONTEXT-MAKER AGENT                 │
├──────────────────────────────────────┤
│  Widening strategies:                │
│  ├─ heading-bounded                  │
│  │   └─ Expand to full section      │
│  ├─ sliding-window                   │
│  │   └─ Include ±1 neighbors        │
│  └─ full-section                     │
│      └─ Expand to top-level section  │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  WRITER AGENT                        │
├──────────────────────────────────────┤
│  ├─ Receives top 20 passages         │
│  ├─ Generates answer with citations  │
│  └─ Format: [1], [2], etc.           │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  VERIFIER AGENT                      │
├──────────────────────────────────────┤
│  Checks:                             │
│  ├─ Citation count > 0               │
│  ├─ Citation rate > 50%              │
│  ├─ Answer length adequate           │
│  └─ Decision: pass/retry with widen  │
└──────────────────────────────────────┘
       ↓
    (if retry)
       ↓
    Back to Context-Maker with aggressive widening
       ↓
    Return final answer
```

## Data Flow

### D1 Database Tables

1. **documents**: File metadata, status, full text
2. **passages**: Chunked text with heading hierarchy
3. **bm25_terms**: Inverted index (term → passage)
4. **bm25_idf**: IDF scores for all terms
5. **bm25_stats**: Document statistics for BM25 scoring
6. **document_summaries**: LLM-generated summaries
7. **document_keywords**: Extracted keywords (JSON array)
8. **chunk_contexts**: LLM-generated contexts for each chunk
9. **section_boundaries**: Heading hierarchy for widening

### R2 Storage

```
/user-{user_id}/{document_id}.txt
```

Raw file storage for backup and reprocessing.

### Vectorize Index

```
Namespace: user-{user_id}
Vector ID: {passage_id}
Dimensions: 768 (BGE-base-en-v1.5)
Metadata:
  - document_id
  - file_name
  - passage_index
  - heading
  - start_line, end_line
  - original_text
  - contextualized_text
```

### Queue Messages

```typescript
{
  type: 'process_document' | 'generate_summary' | 
        'generate_contexts' | 'generate_embeddings',
  document_id: string,
  user_id: string
}
```

## Key Algorithms

### 1. Multi-Signal Heading Detection

```
For each line:
  score = 0
  
  Positive signals:
  + ALL_CAPS: +3
  + Numbered (1., 1.1, etc.): +3
  + Title Case: +2
  + Short length (<120 chars): +1
  + Followed by blank line: +1
  + Ends with colon: +1
  + Contains "Section", "Chapter": +3
  
  Negative signals:
  - Contains "?": -2
  - Contains "!" (not ALL_CAPS): -1
  - Contains "note", "important": -1
  
  if score >= 5:
    → This is a heading
    → Determine level (1-3) based on numbering
```

### 2. Hierarchical Chunking

```
1. Detect all headings
2. For each section between headings:
   if tokens <= 5000:
     → Single chunk
   else:
     → Look for sub-headings
     if sub-headings exist:
       → Split by sub-headings
     else:
       → Split by paragraph boundaries
       → Maintain ~5000 token limit
3. Store parent_section_id for each chunk
   → Enables section-based widening
```

### 3. BM25 Scoring

```
For each term t in query:
  idf = log((N - df + 0.5) / (df + 0.5) + 1)
  
  For each passage d:
    tf = term frequency in d
    docLen = word count of d
    avgDocLen = average across all passages
    
    norm = 1 - b + b * (docLen / avgDocLen)
    baseScore = idf * ((tf * (k1 + 1)) / (tf + k1 * norm))
    
    rarityBoost = idf > 4.0 ? 1.5 : 1.0
    positionWeight = heading ? 1.5 : 1.0
    
    score = baseScore * rarityBoost * positionWeight
```

### 4. Batched Context Generation

```
For 187 chunks:
  Split into batches of 20
  
  For each batch:
    prompt = f"""
    Generate 1-2 sentence context for each chunk.
    Document: {file_name}
    Summary: {doc_summary}
    
    Chunks:
    1. {chunk[0].text[:200]}
    2. {chunk[1].text[:200]}
    ...
    20. {chunk[19].text[:200]}
    """
    
    response = LLM(prompt)
    contexts = parse_json(response)
    
    for chunk, context in zip(batch, contexts):
      contextualized_text = context + "\n\n" + chunk.text
      save_to_db(chunk.id, contextualized_text)

Total: 10 LLM calls instead of 187
```

## Performance Characteristics

### Latency Breakdown

**Method 1 (BM25 Direct):**
- BM25 search: 100ms
- Embedding rerank: 150ms
- LLM answer: 1200ms
- **Total: ~1450ms**

**Method 2 (BM25 + Agents):**
- BM25 search: 100ms
- Supervisor: 50ms
- Context-Maker (if widening): 300ms
- Writer: 1500ms
- Verifier: 100ms
- **Total: ~2050ms (no widening) to ~3500ms (with widening)**

**Method 3 (Vector + Agents):**
- Vector search: 200ms
- Supervisor: 50ms
- Context-Maker: 300ms
- Writer: 1500ms
- Verifier: 100ms
- **Total: ~2150ms to ~4200ms**

**Method 4 (HyDE + Agents):**
- HyDE generation: 500ms
- Vector search: 200ms
- Supervisor: 50ms
- Context-Maker: 300ms
- Writer: 1500ms
- Verifier: 100ms
- **Total: ~2650ms to ~5500ms**

### Scaling Characteristics

**Documents:**
- 1 document: ~20s processing
- 10 documents: ~200s (parallel processing possible)
- 100 documents: ~2000s (~33 minutes)

**Queries:**
- Single user: All methods < 6s
- 10 concurrent users: ~6s per user (Cloudflare auto-scales)
- 100 concurrent users: ~6s per user (linear scaling)

**Storage:**
- 100-page doc: ~187 chunks, ~500KB in D1, ~2MB in Vectorize
- 1000 documents: ~187k chunks, ~500MB in D1, ~2GB in Vectorize
- D1 limit: 10GB (can handle ~20k documents)
- Vectorize limit: millions of vectors

## Future Optimizations

1. **Parallel batch processing**: Run context enrichment batches in parallel (5 concurrent)
2. **Caching**: Cache query analysis for repeated queries
3. **Smart routing**: Learn from user clicks which method is best for query type
4. **Streaming**: Stream answers as they're generated
5. **Cross-encoder reranking**: Final polish on top-20 passages
6. **Multi-document queries**: Query across all user documents simultaneously
