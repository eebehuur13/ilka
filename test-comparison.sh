#!/bin/bash

# Test script to compare ilka/zyn and rag systems
# NO CODE CHANGES - TESTING ONLY

ILKA_URL="https://ilka-ui.pages.dev"
RAG_URL="https://rag-playground.pages.dev"

USER_ID="test-user-001"

echo "=========================================="
echo "SYSTEM COMPARISON TEST"
echo "=========================================="
echo ""

# Step 1: Check document status in ilka
echo "1. Checking NEP2020.txt status in ilka/zyn..."
echo "GET ${ILKA_URL}/api/documents?user_id=${USER_ID}"
echo ""

# Get documents list
DOCS_RESPONSE=$(curl -s "${ILKA_URL}/api/documents?user_id=${USER_ID}")
echo "Documents response:"
echo "$DOCS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DOCS_RESPONSE"
echo ""

# Extract document ID if available
DOC_ID=$(echo "$DOCS_RESPONSE" | python3 -c "import sys, json; docs = json.load(sys.stdin).get('documents', []); print(next((d['id'] for d in docs if 'NEP' in d.get('file_name', '')), 'not-found'))" 2>/dev/null)

if [ "$DOC_ID" != "not-found" ]; then
  echo "Found NEP2020 document: $DOC_ID"
  echo "Checking status..."
  STATUS_RESPONSE=$(curl -s "${ILKA_URL}/api/status/${DOC_ID}")
  echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
  echo ""
else
  echo "NEP2020 document not found in ilka!"
  echo ""
fi

echo "=========================================="
echo "Done checking status"
echo "=========================================="
