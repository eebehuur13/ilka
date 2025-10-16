import type { Env, ScoredPassage, Answer } from '../types';

export class WriterAgent {
  constructor(private readonly env: Env) {}

  async write(query: string, passages: ScoredPassage[]): Promise<Answer> {
    const startTime = Date.now();
    
    const evidenceBlocks = passages.slice(0, 20).map((p, idx) => {
      return `[${idx + 1}] ${p.heading || 'Passage'} [${p.start_line}-${p.end_line}]\n${p.text}`;
    }).join('\n\n---\n\n');

    const prompt = `Answer this question using ONLY the provided evidence blocks.

Question: ${query}

Evidence:
${evidenceBlocks}

Rules:
1. Every sentence must cite a source using [block-number]
2. If information is not in the blocks, state "I don't know"
3. Be concise and direct
4. Synthesize information across blocks when relevant

Answer:`;

    const response = await this.env.AI.run('@cf/openai/gpt-oss-120b', {
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: 1500,
      temperature: 0.15
    });

    const answerText = (response as any).output?.[0]?.content?.[0]?.text || (response as any).response || '';
    const citations = this.extractCitations(answerText, passages);

    return {
      method: 'writer',
      text: answerText,
      citations,
      confidence: citations.length > 0 ? 'high' : 'low',
      latency_ms: Date.now() - startTime
    };
  }

  private extractCitations(text: string, passages: ScoredPassage[]) {
    if (!text) return [];
    const citationMatches = text.match(/\[(\d+)\]/g) || [];
    const citedIndices = new Set(
      citationMatches.map(m => parseInt(m.replace(/\[|\]/g, '')) - 1)
    );

    return Array.from(citedIndices)
      .filter(idx => idx >= 0 && idx < passages.length)
      .map(idx => {
        const passage = passages[idx];
        return {
          file_name: 'document',
          start_line: passage.start_line,
          end_line: passage.end_line,
          text: passage.text.substring(0, 200)
        };
      });
  }
}
