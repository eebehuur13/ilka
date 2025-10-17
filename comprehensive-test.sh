#!/bin/bash

# Comprehensive test comparing ilka/zyn and rag systems
# NO CODE CHANGES - READ-ONLY TESTING

ILKA_WORKER="https://ilka.eebehuur13.workers.dev"
RAG_WORKER="https://rag-worker.eebehuur13.workers.dev"

# Try common user IDs
USER_IDS=("test-user" "test-user-001" "user-123" "demo-user" "harishadithya")

echo "=========================================="
echo "ILKA/ZYN vs RAG COMPARISON TEST"
echo "=========================================="
echo ""

echo "Step 1: Finding NEP2020.txt in ilka/zyn..."
echo ""

for USER_ID in "${USER_IDS[@]}"; do
  echo "Checking user_id: $USER_ID"
  RESPONSE=$(curl -s "${ILKA_WORKER}/documents?user_id=${USER_ID}")
  
  # Check if response contains NEP
  if echo "$RESPONSE" | grep -q "NEP"; then
    echo "✓ Found NEP2020 for user: $USER_ID"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null
    FOUND_USER_ID="$USER_ID"
    break
  fi
done

if [ -z "$FOUND_USER_ID" ]; then
  echo "⚠ NEP2020 not found in any checked user_id"
  echo "Listing all documents for test-user..."
  curl -s "${ILKA_WORKER}/documents?user_id=test-user" | python3 -m json.tool 2>/dev/null
fi

echo ""
echo "=========================================="
echo "Step 2: Checking RAG system files..."
echo "=========================================="
echo ""

curl -s "${RAG_WORKER}/api/files" | python3 -m json.tool 2>/dev/null | head -50

echo ""
echo "=========================================="
echo "Step 3: Testing with sample questions..."
echo "=========================================="
echo ""
