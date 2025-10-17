#!/bin/bash

# Complete cleanup script - removes all documents from all systems

API_URL="https://ilka.eebehuur13.workers.dev"

echo "=========================================="
echo "COMPLETE SYSTEM CLEANUP"
echo "=========================================="
echo "This will delete ALL documents from:"
echo "  - D1 Database (documents, passages, contexts, BM25)"
echo "  - R2 Storage (files)"
echo "  - Vectorize (embeddings)"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo ""
echo "Step 1: Finding all users and documents..."

# Get all unique user IDs from documents
USERS=$(npx wrangler d1 execute ilka-db --remote --command "SELECT DISTINCT user_id FROM documents" 2>/dev/null | grep -E '^[a-zA-Z0-9-]+$' || echo "")

if [ -z "$USERS" ]; then
    echo "No users found in database"
else
    echo "Found users:"
    echo "$USERS"
fi

echo ""
echo "Step 2: Getting all documents..."

# Get all document IDs
DOC_IDS=$(npx wrangler d1 execute ilka-db --remote --command "SELECT id, file_name, user_id FROM documents" 2>/dev/null)

echo "$DOC_IDS"

# Extract just the IDs for deletion
DOCUMENT_COUNT=$(npx wrangler d1 execute ilka-db --remote --command "SELECT COUNT(*) as count FROM documents" 2>/dev/null | grep -oE '[0-9]+' | head -1)

echo ""
echo "Found $DOCUMENT_COUNT documents"

if [ "$DOCUMENT_COUNT" = "0" ]; then
    echo "No documents to clean up"
    exit 0
fi

echo ""
echo "Step 3: Deleting all documents via API..."

# For each user, list and delete their documents
for user_id in $USERS; do
    echo "Processing user: $user_id"
    
    # Get documents for this user
    DOCS=$(curl -s "$API_URL/documents?user_id=$user_id")
    
    # Parse document IDs
    DOC_LIST=$(echo "$DOCS" | jq -r '.documents[]?.id // empty' 2>/dev/null)
    
    if [ -z "$DOC_LIST" ]; then
        echo "  No documents found via API for user $user_id"
        continue
    fi
    
    # Delete each document
    for doc_id in $DOC_LIST; do
        echo "  Deleting document: $doc_id"
        DELETE_RESULT=$(curl -s -X DELETE "$API_URL/documents/$doc_id?user_id=$user_id")
        echo "    Result: $(echo $DELETE_RESULT | jq -r '.message // .error' 2>/dev/null || echo $DELETE_RESULT)"
    done
done

echo ""
echo "Step 4: Direct database cleanup (in case API missed anything)..."

# Delete all BM25 data
echo "  Clearing BM25 indexes..."
npx wrangler d1 execute ilka-db --remote --command "DELETE FROM bm25_terms" 2>/dev/null
npx wrangler d1 execute ilka-db --remote --command "DELETE FROM bm25_idf" 2>/dev/null
npx wrangler d1 execute ilka-db --remote --command "DELETE FROM bm25_stats" 2>/dev/null

# Delete all contexts
echo "  Clearing chunk contexts..."
npx wrangler d1 execute ilka-db --remote --command "DELETE FROM chunk_contexts" 2>/dev/null

# Delete all summaries
echo "  Clearing document summaries..."
npx wrangler d1 execute ilka-db --remote --command "DELETE FROM document_summaries" 2>/dev/null

# Delete all passages
echo "  Clearing passages..."
npx wrangler d1 execute ilka-db --remote --command "DELETE FROM passages" 2>/dev/null

# Delete all documents
echo "  Clearing documents..."
npx wrangler d1 execute ilka-db --remote --command "DELETE FROM documents" 2>/dev/null

echo ""
echo "Step 5: Clearing R2 storage..."

# List all objects in R2
R2_OBJECTS=$(npx wrangler r2 object list ilka-documents --json 2>/dev/null | jq -r '.objects[]?.key // empty' 2>/dev/null || echo "")

if [ -z "$R2_OBJECTS" ]; then
    echo "  No objects found in R2"
else
    echo "  Found objects in R2, deleting..."
    for key in $R2_OBJECTS; do
        echo "    Deleting: $key"
        npx wrangler r2 object delete ilka-documents "$key" 2>/dev/null
    done
fi

echo ""
echo "Step 6: Verifying cleanup..."

# Verify database is empty
REMAINING_DOCS=$(npx wrangler d1 execute ilka-db --remote --command "SELECT COUNT(*) as count FROM documents" 2>/dev/null | grep -oE '[0-9]+' | head -1)
REMAINING_PASSAGES=$(npx wrangler d1 execute ilka-db --remote --command "SELECT COUNT(*) as count FROM passages" 2>/dev/null | grep -oE '[0-9]+' | head -1)
REMAINING_BM25=$(npx wrangler d1 execute ilka-db --remote --command "SELECT COUNT(*) as count FROM bm25_terms" 2>/dev/null | grep -oE '[0-9]+' | head -1)

echo "  Documents remaining: $REMAINING_DOCS"
echo "  Passages remaining: $REMAINING_PASSAGES"
echo "  BM25 terms remaining: $REMAINING_BM25"

# Verify R2 is empty
REMAINING_R2=$(npx wrangler r2 object list ilka-documents --json 2>/dev/null | jq -r '.objects | length' 2>/dev/null || echo "0")
echo "  R2 objects remaining: $REMAINING_R2"

echo ""
echo "=========================================="
echo "✅ CLEANUP COMPLETE"
echo "=========================================="
echo ""
echo "Note: Vectorize embeddings cannot be bulk deleted via CLI."
echo "Vectors will be cleaned up automatically when documents are deleted via API."
echo "If vectors remain orphaned, they will not match any document IDs and won't affect searches."
echo ""
echo "System is now clean and ready for fresh uploads."
