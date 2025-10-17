#!/bin/bash

# Comprehensive test comparing ilka/zyn and rag systems
# NO CODE CHANGES - READ-ONLY TESTING

ILKA_WORKER="https://ilka.eebehuur13.workers.dev"
RAG_WORKER="https://rag-worker.eebehuur13.workers.dev"
USER_ID="test-comparison-user"
RAG_FILE_ID="25dec8fe-6220-4b86-bfbc-108a2d4f8b64"

echo "================================================================================"
echo "ILKA/ZYN vs RAG SYSTEM COMPARISON TEST"
echo "================================================================================"
echo "Timestamp: $(date)"
echo "User ID: $USER_ID"
echo ""

# Step 1: Upload NEP2020.txt to ilka
echo "================================================================================"
echo "STEP 1: UPLOADING NEP2020.txt TO ILKA/ZYN"
echo "================================================================================"
echo ""

NEP_CONTENT=$(cat /Users/harishadithya/ilka/NEP2020.txt)
UPLOAD_DATA=$(python3 -c "import json, sys; print(json.dumps({'file_name': 'NEP2020.txt', 'content': sys.stdin.read(), 'user_id': '$USER_ID'}))" <<< "$NEP_CONTENT")

UPLOAD_RESPONSE=$(curl -s -X POST "$ILKA_WORKER/upload" \
  -H "Content-Type: application/json" \
  -d "$UPLOAD_DATA")

echo "Upload Response:"
echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
echo ""

DOC_ID=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('document_id', ''))" 2>/dev/null)

if [ -z "$DOC_ID" ]; then
  echo "✗ Failed to get document ID. Cannot proceed."
  exit 1
fi

echo "✓ Document ID: $DOC_ID"
echo ""

# Step 2: Wait for processing
echo "================================================================================"
echo "STEP 2: WAITING FOR ILKA/ZYN TO FINISH PROCESSING"
echo "================================================================================"
echo "Expected time: ~15-20 seconds"
echo ""

MAX_ATTEMPTS=40
for i in $(seq 1 $MAX_ATTEMPTS); do
  STATUS_RESPONSE=$(curl -s "$ILKA_WORKER/status/$DOC_ID")
  STATUS=$(echo "$STATUS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null)
  
  echo "Attempt $i/$MAX_ATTEMPTS: Status = $STATUS"
  
  if [ "$STATUS" = "ready" ]; then
    echo "✓ Document is ready!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "✗ Document processing failed!"
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null
    exit 1
  fi
  
  sleep 5
done

if [ "$STATUS" != "ready" ]; then
  echo "⚠ Document may not be ready, but proceeding with tests..."
fi

echo ""

# Step 3: Run comparison tests
echo "================================================================================"
echo "STEP 3: RUNNING COMPARISON TESTS"
echo "================================================================================"
echo ""

# Create results file
RESULTS_FILE="/Users/harishadithya/ilka/COMPARISON_RESULTS.md"
cat > "$RESULTS_FILE" << 'EOF'
# ILKA/ZYN vs RAG Comparison Test Results

**Test Date:** $(date)
**Document:** NEP2020.txt

## Test Configuration
- **ILKA Worker:** https://ilka.eebehuur13.workers.dev
- **RAG Worker:** https://rag-worker.eebehuur13.workers.dev
- **User ID:** test-comparison-user

---

EOF

# Test questions
declare -a questions=(
  "What is the National Education Policy 2020?"
  "What are the key recommendations for Early Childhood Care and Education?"
  "How does NEP 2020 propose to restructure school education?"
  "What role do teachers play in implementing the new curriculum framework?"
  "What are the target years and goals mentioned in NEP 2020?"
  "How does NEP 2020 address equitable and inclusive education?"
)

declare -a types=(
  "Simple Factual"
  "Specific Section"
  "Structural Change"
  "Multi-Section"
  "Numerical Data"
  "Complex Topic"
)

for idx in "${!questions[@]}"; do
  QUESTION="${questions[$idx]}"
  TYPE="${types[$idx]}"
  NUM=$((idx + 1))
  
  echo "================================================================================"
  echo "TEST $NUM: $TYPE"
  echo "Question: $QUESTION"
  echo "================================================================================"
  echo ""
  
  # Add to results file
  cat >> "$RESULTS_FILE" << EOF

## Test $NUM: $TYPE

**Question:** $QUESTION

EOF
  
  # Test RAG
  echo "Testing RAG system..."
  RAG_START=$(date +%s%3N)
  RAG_RESPONSE=$(curl -s -X POST "$RAG_WORKER/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$QUESTION\", \"fileId\": \"$RAG_FILE_ID\", \"methodId\": \"agr/baseline\"}")
  RAG_END=$(date +%s%3N)
  RAG_LATENCY=$((RAG_END - RAG_START))
  
  RAG_ANSWER=$(echo "$RAG_RESPONSE" | python3 -c "import sys, json; r=json.load(sys.stdin); print(r.get('answer', 'ERROR')[:500])" 2>/dev/null)
  RAG_SOURCES=$(echo "$RAG_RESPONSE" | python3 -c "import sys, json; r=json.load(sys.stdin); print(len(r.get('sources', [])))" 2>/dev/null)
  
  echo "✓ RAG completed in ${RAG_LATENCY}ms"
  echo "  Answer length: ${#RAG_ANSWER} chars"
  echo "  Citations: $RAG_SOURCES"
  echo ""
  
  cat >> "$RESULTS_FILE" << EOF
### RAG System (AGR Baseline)

**Latency:** ${RAG_LATENCY}ms  
**Citations:** $RAG_SOURCES  
**Answer Length:** ${#RAG_ANSWER} characters

**Answer:**
\`\`\`
$RAG_ANSWER
\`\`\`

EOF
  
  # Test ILKA
  echo "Testing ILKA/ZYN system..."
  ILKA_START=$(date +%s%3N)
  ILKA_RESPONSE=$(curl -s -X POST "$ILKA_WORKER/query" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$QUESTION\", \"user_id\": \"$USER_ID\", \"methods\": [\"method1\", \"method2\", \"method3\", \"method4\"]}")
  ILKA_END=$(date +%s%3N)
  ILKA_LATENCY=$((ILKA_END - ILKA_START))
  
  echo "✓ ILKA completed in ${ILKA_LATENCY}ms"
  echo ""
  
  # Parse ilka responses
  METHODS=$(echo "$ILKA_RESPONSE" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    answers = r.get('answers', [])
    for ans in answers:
        method = ans.get('method', 'unknown')
        text = ans.get('text', '')
        citations = len(ans.get('citations', []))
        confidence = ans.get('confidence', 'N/A')
        latency = ans.get('latency_ms', 0)
        print(f'{method}|{len(text)}|{citations}|{confidence}|{latency}')
except:
    print('ERROR|0|0|N/A|0')
" 2>/dev/null)
  
  cat >> "$RESULTS_FILE" << EOF
### ILKA/ZYN System (All Methods)

**Total Latency:** ${ILKA_LATENCY}ms

EOF
  
  while IFS='|' read -r method length citations confidence latency; do
    echo "  - $method: ${length} chars, ${citations} citations, ${confidence} confidence, ${latency}ms"
    
    # Get actual answer text for this method
    METHOD_ANSWER=$(echo "$ILKA_RESPONSE" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    for ans in r.get('answers', []):
        if ans.get('method') == '$method':
            print(ans.get('text', '')[:500])
            break
except:
    print('ERROR')
" 2>/dev/null)
    
    cat >> "$RESULTS_FILE" << EOF
**Method:** $method  
**Latency:** ${latency}ms  
**Citations:** ${citations}  
**Confidence:** ${confidence}  
**Answer Length:** ${length} characters

**Answer:**
\`\`\`
$METHOD_ANSWER
\`\`\`

---

EOF
  done <<< "$METHODS"
  
  echo ""
  sleep 2
done

# Step 4: Generate summary
echo "================================================================================"
echo "GENERATING COMPARISON SUMMARY"
echo "================================================================================"
echo ""

cat >> "$RESULTS_FILE" << 'EOF'

## Overall Analysis

### System Comparison

| Aspect | RAG (AGR Baseline) | ILKA/ZYN |
|--------|-------------------|----------|
| Search Method | BM25 lexical search | BM25 + Vector + HyDE + AGR |
| Citation Style | Line ranges (e.g., file:123-145) | Passage-based |
| Multi-method | Single method | 4 parallel methods |
| Context Widening | Adaptive (0-3 rounds) | Per-method |
| Agent Architecture | 5-agent pipeline | Per-method agents |

### Strengths & Weaknesses

**RAG System:**
- ✓ Simple, focused approach
- ✓ Clear line-range citations
- ✓ Fast single-method execution
- ✗ Single retrieval strategy
- ✗ No semantic search fallback

**ILKA/ZYN System:**
- ✓ Multiple retrieval methods
- ✓ Semantic + lexical search
- ✓ HyDE for complex queries
- ✓ Parallel execution
- ✗ More complex
- ✗ Higher latency overall
- ✗ May struggle with method selection

EOF

echo "✓ Comparison report generated: $RESULTS_FILE"
echo ""
echo "================================================================================"
echo "TEST COMPLETE"
echo "================================================================================"
echo ""
echo "Results saved to: $RESULTS_FILE"
echo "Raw responses available in shell output above"
echo ""
