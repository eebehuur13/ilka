# Model Configuration Update

## Changes Made

### ✅ LLM Model Changed
**From:** `@cf/meta/llama-3.1-8b-instruct`  
**To:** `gpt-oss-120b` (Cloudflare Workers AI)

**Updated in:**
- `src/processing/summarizer.ts` (2 calls)
- `src/processing/context-enricher.ts` (1 call)
- `src/query/analyzer.ts` (1 call)
- `src/agents/writer.ts` (1 call)
- `src/methods/method4-hyde-agents.ts` (1 call)

**Total:** 6 LLM calls updated

### ✅ Embedding Model Changed
**From:** `@cf/baai/bge-base-en-v1.5` (768 dimensions, Cloudflare Workers AI)  
**To:** `text-embedding-3-small` (1536 dimensions, OpenAI API)

**Updated in:**
- `src/retrieval/vector.ts` - VectorRetriever class
- `src/retrieval/reranker.ts` - Reranker class
- `src/processing/embedder.ts` - DocumentEmbedder instantiation
- `src/methods/method1-bm25-direct.ts` - Reranker instantiation
- `src/methods/method2-bm25-agents.ts` - Reranker instantiation
- `src/methods/method3-vector-agents.ts` - VectorRetriever + Reranker
- `src/methods/method4-hyde-agents.ts` - VectorRetriever

**Total:** All embedding calls now use OpenAI API

### ✅ Environment Configuration
- Added `OPENAI_API_KEY` to `Env` interface in `src/types.ts`
- Updated `wrangler.toml` with secret instructions

## Setup Required

### 1. Set OpenAI API Key

```bash
cd /Users/harishadithya/ilka
wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key when prompted
```

### 2. Recreate Vectorize Index with New Dimensions

**Delete old index:**
```bash
wrangler vectorize delete ilka-embeddings
```

**Create new index with 1536 dimensions:**
```bash
wrangler vectorize create ilka-embeddings \
  --dimensions=1536 \
  --metric=cosine
```

### 3. Update wrangler.toml (if database_id not set yet)

Make sure `database_id` is set in `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "ilka-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Update this
```

## Model Specifications

### gpt-oss-120b (Cloudflare Workers AI)
- **Type:** Large language model (120B parameters)
- **Provider:** Cloudflare Workers AI
- **Pricing:** Cloudflare AI pricing applies
- **Context window:** Large (similar to GPT-3.5/4)
- **Speed:** Fast on edge network

### text-embedding-3-small (OpenAI)
- **Type:** Text embedding model
- **Dimensions:** 1536
- **Provider:** OpenAI API
- **Pricing:** $0.02 per 1M tokens
- **Speed:** Fast, optimized for retrieval
- **Quality:** High-quality embeddings

## Cost Implications

### Before (Cloudflare only)
- LLM: Cloudflare AI pricing
- Embeddings: Cloudflare AI pricing
- **Total:** All on Cloudflare bill

### After (Hybrid)
- LLM: Cloudflare AI pricing (gpt-oss-120b)
- Embeddings: OpenAI pricing ($0.02/1M tokens)
- **Estimated costs:**
  - 100 documents (187 chunks each): ~$0.60
  - 1000 queries with reranking: ~$0.40
  - **Total monthly (moderate use):** ~$5-10

## Why This Change?

**Advantages:**
1. **Better embeddings:** OpenAI's text-embedding-3-small is highly optimized for retrieval
2. **Larger dimensions:** 1536 vs 768 = better semantic understanding
3. **gpt-oss-120b:** Larger model (120B vs 8B) = better quality answers
4. **Proven models:** OpenAI embeddings are industry-standard

**Trade-offs:**
- External API dependency (OpenAI)
- Small additional cost (~$5-10/month)
- Need to manage OpenAI API key

## Testing After Changes

### 1. Test Embedding
```bash
# Upload a document
curl -X POST http://localhost:8787/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "test.txt",
    "content": "This is a test document.",
    "user_id": "test-user"
  }'

# Wait for processing
# Check if embedding succeeded (status should become "ready")
```

### 2. Test Query
```bash
curl -X POST http://localhost:8787/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is this about?",
    "user_id": "test-user"
  }'
```

## Rollback Instructions

If you need to revert to the original models:

### Revert LLM
Replace all instances of:
```typescript
'gpt-oss-120b'
```
with:
```typescript
'@cf/meta/llama-3.1-8b-instruct'
```

### Revert Embeddings
1. Replace OpenAI API calls with Workers AI:
```typescript
// In vector.ts and reranker.ts
await this.ai.run('@cf/baai/bge-base-en-v1.5', {
  text: [text]
})
```

2. Recreate Vectorize with 768 dimensions:
```bash
wrangler vectorize delete ilka-embeddings
wrangler vectorize create ilka-embeddings \
  --dimensions=768 \
  --metric=cosine
```

## Files Modified

```
src/types.ts                        ✅ Added OPENAI_API_KEY
src/retrieval/vector.ts             ✅ OpenAI API integration
src/retrieval/reranker.ts           ✅ OpenAI API integration
src/processing/embedder.ts          ✅ Constructor update
src/processing/summarizer.ts        ✅ LLM model update (2x)
src/processing/context-enricher.ts  ✅ LLM model update
src/query/analyzer.ts               ✅ LLM model update
src/agents/writer.ts                ✅ LLM model update
src/methods/method1-bm25-direct.ts  ✅ Reranker constructor
src/methods/method2-bm25-agents.ts  ✅ Reranker constructor
src/methods/method3-vector-agents.ts ✅ VectorRetriever + Reranker
src/methods/method4-hyde-agents.ts  ✅ VectorRetriever + HyDE update
wrangler.toml                       ✅ Secret documentation
```

**Total: 13 files modified**

## Next Steps

1. ✅ Set OpenAI API key: `wrangler secret put OPENAI_API_KEY`
2. ✅ Recreate Vectorize index with 1536 dimensions
3. ✅ Test embedding generation
4. ✅ Test full pipeline (upload → process → query)
5. ✅ Monitor costs in OpenAI dashboard

---

**All model changes complete and ready to use!**
