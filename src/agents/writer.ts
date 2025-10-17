import type { Env, ScoredPassage, Answer } from '../types';

export class WriterAgent {
  constructor(private readonly env: Env) {}

  async write(query: string, passages: ScoredPassage[]): Promise<Answer> {
    const startTime = Date.now();
    
    const evidenceBlocks = passages.slice(0, 20).map((p, idx) => {
      const fileName = p.file_name || 'document';
      const heading = p.heading ? ` - ${p.heading}` : '';
      return `[${idx + 1}] ${fileName}:${p.start_line}-${p.end_line}${heading}\n${p.text}`;
    }).join('\n\n---\n\n');

    const systemPrompt = `You are a grounded question-answering system. Your purpose is to provide accurate answers based solely on the provided source material.

Critical rules:
- Every claim must cite a source using [block-number] format
- Never make statements without citations
- If information is not in the sources, explicitly state "I don't have enough information to answer this"
- Be precise and concise
- Synthesize information across multiple sources when relevant`;

    const prompt = `Answer this question using ONLY the provided evidence blocks.

Question: ${query}

Evidence:
${evidenceBlocks}

Provide a well-cited answer:`;

    const response = await this.env.AI.run('@cf/openai/gpt-oss-120b', {
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
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
          file_name: passage.file_name || 'document',
          start_line: passage.start_line,
          end_line: passage.end_line,
          text: passage.text.substring(0, 200)
        };
      });
  }
}
