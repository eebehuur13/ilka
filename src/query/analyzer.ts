import type { Env, QueryAnalysis } from '../types';
import { GeminiClient } from '../llm/gemini-client';

export class QueryAnalyzer {
  constructor(private readonly env: Env) {}

  async analyze(query: string): Promise<QueryAnalysis> {
    const prompt = `Analyze this query comprehensively:

Query: "${query}"

Provide:
1. CLASSIFICATION
   - intent: factual/exploratory/analytical/summary/comparison
   - complexity: simple/moderate/complex
   - targetType: general/specific_doc/multi_doc
   - targetDocument: (if user named a specific file, extract it, otherwise null)

2. EXPANSION
   - synonyms: 3-5 synonyms for key terms
   - relatedTerms: 3-5 related/broader terms
   - rephrasings: 3 alternative phrasings

3. HYDE
   - hypothetical_answer: 2-3 sentence hypothetical answer this query might have

4. ROUTING
   - recommended_methods: array of recommended methods from [bm25, vector, hyde, summary]
   - reasoning: why these methods

5. DECOMPOSITION (if complex)
   - sub_questions: array of sub-questions if multi-part query, otherwise null

Return ONLY valid JSON using snake_case for all fields:
{
  "intent": "...",
  "complexity": "...",
  "target_type": "...",
  "target_document": "..." or null,
  "synonyms": ["...", "..."],
  "related_terms": ["...", "..."],
  "rephrasings": ["...", "...", "..."],
  "hypothetical_answer": "...",
  "recommended_methods": ["...", "..."],
  "reasoning": "...",
  "sub_questions": null or ["...", "..."]
}`;

    try {
      const gemini = new GeminiClient(this.env.GEMINI_API_KEY);
      const parsed = await gemini.generateJSON<QueryAnalysis>(prompt, {
        temperature: 0.3,
        maxTokens: 1500,
      });
      
      console.log('Analyzer: Successfully parsed, hypothetical_answer length:', (parsed.hypothetical_answer || '').length);
      return parsed;
    } catch (error: any) {
      console.error('Analyzer: Failed to parse:', error.message);
      
      return {
        intent: 'factual' as const,
        complexity: 'moderate' as const,
        target_type: 'general' as const,
        target_document: null,
        synonyms: [],
        related_terms: [],
        rephrasings: [query],
        hypothetical_answer: '',
        recommended_methods: ['bm25', 'vector'] as const,
        reasoning: 'Default analysis due to parse error',
        sub_questions: null
      } as QueryAnalysis;
    }
  }
}
