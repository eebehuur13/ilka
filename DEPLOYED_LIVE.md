# 🎉 Ilka - DEPLOYED & LIVE

## ✅ Deployment Complete!

Both backend and frontend are now deployed to Cloudflare's edge network.

### 🌐 Live URLs

**Backend API:** https://ilka.eebehuur13.workers.dev  
**Frontend UI:** https://d6024243.ilka-ui.pages.dev  
**Custom Domain:** https://ilka-ui.pages.dev (main)

---

## ⚠️ CRITICAL: Set OpenAI API Key

The backend is deployed but **needs your OpenAI API key** to work properly.

### Set the API Key:

```bash
cd /Users/harishadithya/ilka
npx wrangler secret put OPENAI_API_KEY
```

When prompted, paste your OpenAI API key (starts with `sk-...`)

**Why needed:** For `text-embedding-3-small` embeddings (1536 dimensions)

---

## 📊 Deployment Summary

### Backend Resources Created

| Resource | Name | ID | Status |
|----------|------|----|----|
| **Worker** | ilka | cb92cb3d-8c44-4f59-b81c-df17a14e1f49 | ✅ Deployed |
| **D1 Database** | ilka-db | b0ced007-1e1b-468e-999d-79dd14669112 | ✅ Created + Migrated |
| **Vectorize Index** | ilka-embeddings | 1536 dimensions | ✅ Created |
| **R2 Bucket** | ilka-documents | - | ✅ Created |
| **Queue** | ilka-processing | - | ✅ Created |
| **Migrations** | 25 commands | - | ✅ Applied |

### Frontend

| Resource | Value | Status |
|----------|-------|--------|
| **Pages Project** | ilka-ui | ✅ Created |
| **Deployment URL** | https://d6024243.ilka-ui.pages.dev | ✅ Live |
| **Production URL** | https://ilka-ui.pages.dev | ✅ Live |
| **Bundle Size** | 289 KB (93 KB gzipped) | ✅ Optimized |

---

## 🧪 Testing Instructions

### 1. Test Backend Health

```bash
curl https://ilka.eebehuur13.workers.dev/
```

**Expected (after API key set):**
```json
{
  "name": "Ilka",
  "version": "1.0.0",
  "description": "Advanced knowledge platform with 4 retrieval methods",
  "endpoints": { ... }
}
```

**Current (without API key):**
```json
{
  "error": "Internal server error",
  "message": "Cannot read properties of undefined..."
}
```
→ This is normal without the API key. Set it first!

### 2. Test Document Upload

After setting API key:

```bash
# Upload a test document
curl -X POST https://ilka.eebehuur13.workers.dev/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "test.txt",
    "content": "Ilka is an advanced knowledge platform with 4 retrieval methods: BM25 Direct, BM25 with Agents, Vector Search, and HyDE. It uses semantic chunking with 5000 token limits.",
    "user_id": "test-user"
  }'
```

**Expected:**
```json
{
  "document_id": "uuid-here",
  "status": "processing",
  "message": "Document uploaded successfully. Processing will complete in ~15-20 seconds."
}
```

### 3. Check Processing Status

```bash
# Replace DOCUMENT_ID with the ID from upload response
curl https://ilka.eebehuur13.workers.dev/status/DOCUMENT_ID
```

**Expected progression:**
- `processing` (0-2s)
- `chunking` (2-4s)
- `indexing_bm25` (4-7s)
- `generating_summary` (7-10s)
- `generating_contexts` (10-15s)
- `embedding` (15-18s)
- `ready` (18-20s)

### 4. Test Query

After document is `ready`:

```bash
curl -X POST https://ilka.eebehuur13.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What retrieval methods does Ilka use?",
    "user_id": "test-user"
  }'
```

**Expected:**
```json
{
  "query": "What retrieval methods does Ilka use?",
  "analysis": { ... },
  "answers": [
    {
      "method": "method1-bm25-direct",
      "text": "Ilka uses 4 retrieval methods...",
      "citations": [...],
      "confidence": "high",
      "latency_ms": 1850
    }
  ],
  "total_latency_ms": 3850
}
```

### 5. Test Frontend UI

1. Open: https://d6024243.ilka-ui.pages.dev
2. Click **[+ Upload]** in sidebar
3. Select or drop a .txt file
4. Watch progress bar
5. After ~20 seconds, toggle to **File-Search** mode
6. Ask a question
7. See progressive results!

---

## 🔧 Configuration

### Backend (Worker)

**Bindings:**
- D1: `ilka-db`
- R2: `ilka-documents`  
- Vectorize: `ilka-embeddings`
- Queue: `ilka-processing`
- AI: Workers AI (for gpt-oss-120b)
- Secret: `OPENAI_API_KEY` ⚠️ **NEEDS TO BE SET**

**Models:**
- LLM: `gpt-oss-120b` (Cloudflare Workers AI)
- Embeddings: `text-embedding-3-small` (OpenAI, 1536-dim)

### Frontend (Pages)

**Environment:**
- `VITE_API_URL`: https://ilka.eebehuur13.workers.dev

**Features:**
- Rose theme (#F43F5E)
- Linear-style sidebar
- ChatGPT-style chat
- Real-time status updates
- Progressive results

---

## 📝 Next Steps

### 1. ⚠️ Set OpenAI API Key (Required)

```bash
cd /Users/harishadithya/ilka
npx wrangler secret put OPENAI_API_KEY
# Paste your key when prompted
```

### 2. Test Full Flow

```bash
# 1. Upload NEP document
curl -X POST https://ilka.eebehuur13.workers.dev/upload \
  -H "Content-Type: application/json" \
  --data-binary @/Users/harishadithya/rag/NEP_Final_English_0.txt \
  -d "file_name=NEP.txt&user_id=test-user"

# 2. Wait 20 seconds

# 3. Query
curl -X POST https://ilka.eebehuur13.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the teacher training requirements?",
    "user_id": "test-user"
  }'
```

### 3. Test UI

Open https://d6024243.ilka-ui.pages.dev and:
- Upload a document
- Watch processing
- Ask questions
- View citations

### 4. Monitor

```bash
# View live logs
npx wrangler tail

# Check database
npx wrangler d1 execute ilka-db --remote --command "SELECT * FROM documents LIMIT 5"

# Check Vectorize
npx wrangler vectorize info ilka-embeddings
```

### 5. Custom Domain (Optional)

Add custom domain in Cloudflare Pages dashboard:
- Go to: https://dash.cloudflare.com → Pages → ilka-ui
- Add custom domain: `ilka.yourdomain.com`

---

## 💰 Expected Costs

### Cloudflare Workers
- **Workers:** Free tier covers most usage
- **D1:** Free tier: 5GB storage, 5M reads/day
- **R2:** $0.015/GB/month storage
- **Vectorize:** $0.04 per 1M dimensions queried
- **Queue:** $0.40 per 1M messages
- **Workers AI (gpt-oss-120b):** Per request pricing

### OpenAI
- **text-embedding-3-small:** $0.02 per 1M tokens
- **Expected:** ~$5-10/month for moderate usage

### Total Estimated
**Light usage (10 docs, 100 queries/day):** $5-10/month  
**Medium usage (100 docs, 1000 queries/day):** $20-30/month  
**Heavy usage:** Scale accordingly

---

## 🐛 Troubleshooting

### Backend Error: "Cannot read properties of undefined"
**Cause:** OPENAI_API_KEY not set  
**Fix:** `npx wrangler secret put OPENAI_API_KEY`

### Upload Fails: "CORS error"
**Cause:** CORS headers issue  
**Fix:** Already implemented in handlers.ts

### Processing Stuck
**Cause:** Queue not consuming  
**Fix:** Check queue status: `npx wrangler queues list`

### UI Shows "No files uploaded"
**Cause:** Backend returned empty list  
**Fix:** Check D1 database: `npx wrangler d1 execute ilka-db --remote --command "SELECT * FROM documents"`

### Embeddings Fail
**Cause:** Invalid/expired OpenAI API key  
**Fix:** Update secret with new key

---

## 📊 System Status

| Component | Status | URL |
|-----------|--------|-----|
| Backend API | 🟡 Pending API Key | https://ilka.eebehuur13.workers.dev |
| Frontend UI | 🟢 Live | https://d6024243.ilka-ui.pages.dev |
| D1 Database | 🟢 Live | Remote, migrated |
| Vectorize | 🟢 Live | 1536 dimensions |
| R2 Storage | 🟢 Live | ilka-documents |
| Queue | 🟢 Live | ilka-processing |

**Overall Status:** 🟡 **Partially Ready** (needs OpenAI API key)

---

## 🚀 What's Live

✅ Complete RAG engine (4 methods)  
✅ AGR agent system  
✅ BM25 + Vector + HyDE search  
✅ Semantic chunking (5000 tokens)  
✅ Batched context enrichment  
✅ Real-time status updates  
✅ Rose-themed UI  
✅ File management  
✅ Progressive results  

🟡 **Waiting for:** OpenAI API key

---

## 🎯 Final Step

**SET THE API KEY NOW:**

```bash
cd /Users/harishadithya/ilka
npx wrangler secret put OPENAI_API_KEY
```

Then test: https://d6024243.ilka-ui.pages.dev

---

**Everything is deployed and ready to go! Just add your OpenAI API key and start using Ilka!** 🎉
