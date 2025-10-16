# Ilka Deployment - LIVE

## ✅ Backend Deployed Successfully!

**Worker URL:** https://ilka.eebehuur13.workers.dev

### Resources Created:
- ✅ D1 Database: `ilka-db` (b0ced007-1e1b-468e-999d-79dd14669112)
- ✅ Vectorize Index: `ilka-embeddings` (1536 dimensions)
- ✅ R2 Bucket: `ilka-documents`
- ✅ Queue: `ilka-processing`
- ✅ Migrations: Applied successfully (25 commands)
- ✅ Worker: Deployed to production

### ⚠️ OpenAI API Key Required

The worker needs your OpenAI API key to work. Set it with:

```bash
cd /Users/harishadithya/ilka
npx wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key (sk-...) when prompted
```

**Why needed:** For `text-embedding-3-small` embeddings (1536 dimensions)

## Test Backend

Once API key is set, test with:

```bash
# Test health endpoint
curl https://ilka.eebehuur13.workers.dev/

# Test upload
curl -X POST https://ilka.eebehuur13.workers.dev/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "test.txt",
    "content": "This is a test document about knowledge platforms.",
    "user_id": "test-user"
  }'
```

## Frontend Deployment

To deploy frontend to Cloudflare Pages:

```bash
cd /Users/harishadithya/ilka/ui

# Update .env for production
echo "VITE_API_URL=https://ilka.eebehuur13.workers.dev" > .env

# Build
npm run build

# Deploy
npx wrangler pages deploy dist --project-name ilka-ui
```

Or connect GitHub repo to Cloudflare Pages dashboard:
- Build command: `cd ui && npm install && npm run build`
- Build output: `ui/dist`
- Environment variable: `VITE_API_URL=https://ilka.eebehuur13.workers.dev`

## Quick Start Checklist

1. [ ] Set OpenAI API key: `npx wrangler secret put OPENAI_API_KEY`
2. [ ] Test backend health: `curl https://ilka.eebehuur13.workers.dev/`
3. [ ] Deploy frontend to Pages
4. [ ] Test full flow: Upload → Process → Query

## Monitoring

```bash
# View worker logs
npx wrangler tail

# Check D1 database
npx wrangler d1 execute ilka-db --remote --command "SELECT COUNT(*) FROM documents"

# Check Vectorize index
npx wrangler vectorize info ilka-embeddings
```
