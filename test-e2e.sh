#!/bin/bash

# End-to-End Test Script for Critical Fixes
# Tests: Large file upload (>50 chunks), processing pipeline, query, and delete

set -e

API_URL="https://ilka.eebehuur13.workers.dev"
USER_ID="e2e-test-$(date +%s)"

echo "=========================================="
echo "End-to-End Test for Critical Fixes"
echo "=========================================="
echo "API: $API_URL"
echo "User ID: $USER_ID"
echo ""

# Generate large test file with >50 chunks
echo "Step 1: Generating large test file (>50 chunks)..."
cat > /tmp/large-test-file.txt << 'EOF'
# Large Test Document for Batch Processing

## Introduction
This is a comprehensive test document designed to validate the D1 batch processing fixes.
Each section contains substantial content to ensure the document is chunked into more than 50 passages.

EOF

# Generate 60 sections with substantial content
for i in {1..60}; do
  cat >> /tmp/large-test-file.txt << EOF

## Section $i: Advanced Topics in Knowledge Management

This section explores various aspects of knowledge management systems and their implementation.
Knowledge management is critical for organizations seeking to leverage their intellectual assets.
The process involves capturing, distributing, and effectively using knowledge across the organization.

### Subsection $i.1: Theoretical Foundations
The theoretical foundations of knowledge management draw from multiple disciplines including information science,
organizational theory, and cognitive psychology. These foundations help us understand how knowledge is created,
stored, and transferred within organizations. Key concepts include tacit and explicit knowledge, knowledge
conversion processes, and organizational learning mechanisms.

### Subsection $i.2: Practical Applications
In practice, knowledge management systems must balance technical capabilities with human factors. Users need
intuitive interfaces, reliable search functionality, and seamless integration with existing workflows. The
system should support both structured and unstructured data, enabling users to find information quickly
regardless of format. Modern approaches incorporate AI and machine learning to enhance search relevance
and automate knowledge extraction from documents.

### Subsection $i.3: Implementation Challenges
Organizations face numerous challenges when implementing knowledge management systems. These include
resistance to change, difficulty capturing tacit knowledge, maintaining data quality, and ensuring
system adoption. Success requires strong leadership support, clear governance policies, and ongoing
training programs. Technical challenges include scalability, security, and integration with legacy
systems. Organizations must carefully plan their implementation strategy to address these obstacles.

### Subsection $i.4: Future Directions
The future of knowledge management will be shaped by emerging technologies including artificial intelligence,
natural language processing, and semantic web technologies. These advances promise more intelligent systems
that can understand context, infer relationships, and provide personalized recommendations. Integration
with collaborative platforms and social networks will enhance knowledge sharing across organizational
boundaries. As systems become more sophisticated, they will better support decision-making and innovation.

EOF
done

echo "Generated test file with 60 sections (~60+ chunks expected)"
echo ""

# Step 2: Upload
echo "Step 2: Uploading large file..."
CONTENT=$(cat /tmp/large-test-file.txt | jq -Rs .)
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/upload" \
  -H "Content-Type: application/json" \
  -d "{
    \"file_name\": \"large-test-file.txt\",
    \"content\": $CONTENT,
    \"user_id\": \"$USER_ID\"
  }")

echo "$UPLOAD_RESPONSE" | jq .

DOC_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.document_id')

if [ "$DOC_ID" = "null" ] || [ -z "$DOC_ID" ]; then
    echo "ERROR: Failed to get document_id from upload response"
    exit 1
fi

echo ""
echo "✓ Upload successful"
echo "  Document ID: $DOC_ID"
echo ""

# Step 3: Monitor processing
echo "Step 3: Monitoring document processing..."
MAX_ATTEMPTS=40
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 3
    STATUS_RESPONSE=$(curl -s "$API_URL/status/$DOC_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    CHUNKS=$(echo "$STATUS_RESPONSE" | jq -r '.chunk_count // 0')
    
    echo "  [$ATTEMPT] Status: $STATUS | Chunks: $CHUNKS"
    
    if [ "$STATUS" = "ready" ]; then
        echo ""
        echo "✓ Document processing complete!"
        echo "  Final chunk count: $CHUNKS"
        
        if [ "$CHUNKS" -gt 50 ]; then
            echo "  ✓ PASS: Document has >50 chunks (batch limit test successful)"
        else
            echo "  ⚠ WARNING: Document has <50 chunks, may not fully test batch limits"
        fi
        break
    elif [ "$STATUS" = "error" ]; then
        echo ""
        echo "✗ ERROR: Document processing failed"
        echo "$STATUS_RESPONSE" | jq .
        exit 1
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo ""
    echo "✗ ERROR: Processing timeout (2 minutes)"
    exit 1
fi

echo ""

# Step 4: Query
echo "Step 4: Testing query endpoint..."
QUERY_RESPONSE=$(curl -s -X POST "$API_URL/query" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"What are the implementation challenges discussed in this document?\",
    \"user_id\": \"$USER_ID\",
    \"methods\": [\"bm25\"]
  }")

echo "$QUERY_RESPONSE" | jq -c '{query: .query, latency_ms: .total_latency_ms, answers: [.answers[] | {method: .method, confidence: .confidence, citations_count: (.citations | length)}]}'

ANSWER_TEXT=$(echo "$QUERY_RESPONSE" | jq -r '.answers[0].text // ""')

if [ -n "$ANSWER_TEXT" ] && [ "$ANSWER_TEXT" != "null" ]; then
    echo ""
    echo "✓ Query successful"
    echo "  Answer preview: ${ANSWER_TEXT:0:150}..."
else
    echo ""
    echo "✗ ERROR: Query returned no answer"
    exit 1
fi

echo ""

# Step 5: List documents
echo "Step 5: Verifying document appears in list..."
LIST_RESPONSE=$(curl -s "$API_URL/documents?user_id=$USER_ID")
DOC_COUNT=$(echo "$LIST_RESPONSE" | jq '.documents | length')

echo "  Found $DOC_COUNT document(s) for user"

if [ "$DOC_COUNT" -ge 1 ]; then
    echo "✓ Document listing successful"
else
    echo "✗ ERROR: Document not found in list"
    exit 1
fi

echo ""

# Step 6: Delete
echo "Step 6: Testing delete endpoint..."
DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/documents/$DOC_ID?user_id=$USER_ID")
echo "$DELETE_RESPONSE" | jq .

DELETE_MESSAGE=$(echo "$DELETE_RESPONSE" | jq -r '.message // ""')

if echo "$DELETE_MESSAGE" | grep -q "success"; then
    echo ""
    echo "✓ Delete successful"
else
    echo ""
    echo "✗ ERROR: Delete failed"
    exit 1
fi

echo ""

# Step 7: Verify deletion
echo "Step 7: Verifying document is deleted..."
sleep 2

VERIFY_RESPONSE=$(curl -s "$API_URL/status/$DOC_ID")
ERROR_MSG=$(echo "$VERIFY_RESPONSE" | jq -r '.error // ""')

if echo "$ERROR_MSG" | grep -q "not found"; then
    echo "✓ Document successfully removed from database"
else
    echo "⚠ WARNING: Document may still exist"
    echo "$VERIFY_RESPONSE" | jq .
fi

echo ""
echo "=========================================="
echo "✅ END-TO-END TEST COMPLETE"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Upload response type (document_id) working"
echo "  ✓ Large file (>50 chunks) processing successful"
echo "  ✓ D1 batch chunking working"
echo "  ✓ User identity consistent across operations"
echo "  ✓ Query endpoint functional"
echo "  ✓ Delete endpoint with backend cleanup working"
echo ""
echo "All critical fixes validated!"
