#!/bin/bash

# Simple comparison test without millisecond timing
ILKA_WORKER="https://ilka.eebehuur13.workers.dev"
RAG_WORKER="https://rag-worker.eebehuur13.workers.dev"
USER_ID="test-comparison-user"
RAG_FILE_ID="25dec8fe-6220-4b86-bfbc-108a2d4f8b64"
ILKA_DOC_ID="690fddc4-3436-4702-9c65-ae5090b3f55a"

echo "================================================================================"
echo "SIMPLE COMPARISON TEST"
echo "================================================================================"
echo ""

# Check ilka status
echo "Checking ILKA document status..."
ILKA_STATUS=$(curl -s "$ILKA_WORKER/status/$ILKA_DOC_ID" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null)
echo "ILKA Status: $ILKA_STATUS"
echo ""

if [ "$ILKA_STATUS" != "ready" ]; then
  echo "⚠ ILKA document not ready yet (status: $ILKA_STATUS)"
  echo "Waiting 30 more seconds..."
  sleep 30
  ILKA_STATUS=$(curl -s "$ILKA_WORKER/status/$ILKA_DOC_ID" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null)
  echo "New status: $ILKA_STATUS"
  echo ""
fi

# Test question
QUESTION="What is the National Education Policy 2020?"

echo "================================================================================"
echo "Testing with question: $QUESTION"
echo "================================================================================"
echo ""

# Test RAG
echo "--- RAG SYSTEM ---"
RAG_RESPONSE=$(curl -s -X POST "$RAG_WORKER/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$QUESTION\", \"fileId\": \"$RAG_FILE_ID\", \"methodId\": \"agr/baseline\"}")

echo "Full RAG Response:"
echo "$RAG_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RAG_RESPONSE"
echo ""

# Test ILKA - Method 1 only for speed
echo "--- ILKA SYSTEM (Method 1 - BM25 Direct) ---"
ILKA_RESPONSE=$(curl -s -X POST "$ILKA_WORKER/query" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUESTION\", \"user_id\": \"$USER_ID\", \"methods\": [\"method1\"]}")

echo "Full ILKA Response:"
echo "$ILKA_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ILKA_RESPONSE"
echo ""

# Save for analysis
cat > "/Users/harishadithya/ilka/quick-test-results.txt" << EOF
QUICK COMPARISON TEST RESULTS
Generated: $(date)

Question: $QUESTION

=== RAG RESPONSE ===
$RAG_RESPONSE

=== ILKA RESPONSE ===
$ILKA_RESPONSE

=== STATUS ===
ILKA Document Status: $ILKA_STATUS
RAG File ID: $RAG_FILE_ID
ILKA Document ID: $ILKA_DOC_ID
EOF

echo "Results saved to: /Users/harishadithya/ilka/quick-test-results.txt"
