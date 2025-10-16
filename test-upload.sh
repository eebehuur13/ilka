#!/bin/bash

# Test script for Ilka

# Read NEP.txt from rag folder
NEP_FILE="/Users/harishadithya/rag/NEP_Final_English_0.txt"

if [ ! -f "$NEP_FILE" ]; then
    echo "NEP file not found at $NEP_FILE"
    exit 1
fi

# Read file content and escape for JSON
CONTENT=$(cat "$NEP_FILE" | jq -Rs .)

# Upload document
echo "Uploading NEP document..."
RESPONSE=$(curl -s -X POST http://localhost:8787/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"file_name\": \"NEP_Final_English_0.txt\",
    \"content\": $CONTENT,
    \"user_id\": \"test-user\"
  }")

echo "$RESPONSE"

# Extract document ID
DOC_ID=$(echo "$RESPONSE" | jq -r '.document_id')

echo ""
echo "Document ID: $DOC_ID"
echo ""
echo "Wait ~20 seconds for processing to complete, then check status:"
echo "curl http://localhost:8787/status/$DOC_ID"
echo ""
echo "Query example:"
echo "curl -X POST http://localhost:8787/query \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"query\": \"What are the teacher training requirements?\", \"user_id\": \"test-user\"}'"
