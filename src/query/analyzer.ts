import type { Env, QueryAnalysis } from '../types';

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

    const response = await this.env.AI.run('@cf/openai/gpt-oss-120b', {
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: 1500,
      temperature: 0.4
    });

    try {
      const text = (response as any).output?.[0]?.content?.[0]?.text || (response as any).response || '';
      
      if (!text) {
        console.error('Analyzer: Empty response from LLM');
        throw new Error('Empty response from LLM');
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Analyzer: No JSON found in response. Text sample:', text.substring(0, 300));
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Analyzer: Successfully parsed, hypothetical_answer length:', (parsed.hypothetical_answer || '').length);
      return parsed as QueryAnalysis;
    } catch (error) {
      console.error('Analyzer: Failed to parse:', error.message);
      
      return {
        intent: 'factual',
        complexity: 'moderate',
        target_type: 'general',
        target_document: null,
        synonyms: [],
        related_terms: [],
        rephrasings: [query],
        hypothetical_answer: '',
        recommended_methods: ['bm25', 'vector'],
        reasoning: 'Default analysis due to parse error',
        sub_questions: null
      };
    }
  }
}
