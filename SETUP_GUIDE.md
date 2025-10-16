# Ilka Setup Guide

## Step 1: Create Cloudflare Resources

You need to create these resources in your Cloudflare account:

### 1. Create D1 Database

```bash
npx wrangler d1 create ilka-db
```

This will output a `database_id`. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ilka-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Update this
```

### 2. Create R2 Bucket

```bash
npx wrangler r2 bucket create ilka-documents
```

### 3. Create Vectorize Index

```bash
npx wrangler vectorize create ilka-embeddings \
  --dimensions=768 \
  --metric=cosine
```

### 4. Create Queue

```bash
npx wrangler queues create ilka-processing
```

## Step 2: Run Migrations

### Local (for development)

```bash
npm run db:migrate
```

### Remote (for production)

```bash
npm run db:migrate:remote
```

## Step 3: Start Development Server

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

## Step 4: Test with NEP Document

```bash
./test-upload.sh
```

This will:
1. Upload the NEP document from `../rag/NEP_Final_English_0.txt`
2. Return a document ID
3. Process the document asynchronously (~20 seconds)

## Step 5: Check Processing Status

```bash
curl http://localhost:8787/status/DOCUMENT_ID
```

Status progression:
1. `processing` → Uploading
2. `chunking` → Detecting headings and chunking
3. `indexing_bm25` → Building BM25 index
4. `generating_summary` → Summarizing document
5. `generating_contexts` → Enriching chunks with context
6. `embedding` → Embedding and storing in Vectorize
7. `ready` → All done!

## Step 6: Query

```bash
curl -X POST http://localhost:8787/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the teacher training requirements in NEP 2020?",
    "user_id": "test-user"
  }'
```

You'll get back multiple answers from different methods:
- Method 1: BM25 Direct (fast, ~2s)
- Method 2: BM25 + Agents (thorough, ~4s)

## Troubleshooting

### Queue not working locally?

Local development with queues can be tricky. If the queue consumer isn't running:

1. Run a separate instance:
```bash
npx wrangler dev --test-scheduled
```

2. Or manually trigger processing by calling the queue handler directly

### Database not found?

Make sure you've:
1. Created the D1 database
2. Updated `wrangler.toml` with the correct `database_id`
3. Run migrations

### Vectorize errors?

Make sure you've created the Vectorize index with the correct dimensions (768 for BGE-base-en-v1.5)

## Deploy to Production

```bash
npm run deploy
```

Then run remote migrations:

```bash
npm run db:migrate:remote
```

## Next Steps

- Try different queries
- Test all 4 methods by requesting specific methods
- Monitor latency and quality
- Adjust BM25 parameters if needed
- Add more documents
