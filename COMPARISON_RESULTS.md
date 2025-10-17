# ILKA/ZYN vs RAG Comparison Test Results

**Test Date:** $(date)
**Document:** NEP2020.txt

## Test Configuration
- **ILKA Worker:** https://ilka.eebehuur13.workers.dev
- **RAG Worker:** https://rag-worker.eebehuur13.workers.dev
- **User ID:** test-comparison-user

---


## Test 1: Simple Factual

**Question:** What is the National Education Policy 2020?


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

