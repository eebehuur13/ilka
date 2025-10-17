import type { Env } from '../types';
import { GeminiClient } from '../llm/gemini-client';
import { truncateToTokenLimit } from '../utils/tokenizer';

export class DocumentSummarizer {
  constructor(private readonly env: Env) {}

  async generateSummary(documentId: string): Promise<void> {
    const doc = await this.getDocument(documentId);
    if (!doc || !doc.full_text) {
      throw new Error(`Document ${documentId} not found or has no text`);
    }

    const textToSummarize = truncateToTokenLimit(doc.full_text as string, 50000);

    const prompt = `Summarize this document comprehensively in 500-1000 words.

Document: ${doc.file_name}
Content: ${textToSummarize}

Include:
- Main topic and purpose
- Key sections (list 8-10 major sections)
- Important entities (people, organizations, dates, numbers)
- Document type/category

Write factually, third-person.`;

    const gemini = new GeminiClient(this.env.GEMINI_API_KEY);
    const result = await gemini.generateContent(prompt, {
      temperature: 0.3,
      maxTokens: 2000,
      thinkingBudget: 0,
    });

    const summary = result.answer;

    const summaryId = `${documentId}-summary`;
    await this.env.DB
      .prepare('INSERT OR REPLACE INTO document_summaries (id, document_id, summary_text, word_count) VALUES (?, ?, ?, ?)')
      .bind(summaryId, documentId, summary, summary.split(/\s+/).length)
      .run();

    await this.extractKeywords(documentId, summary);

    await this.env.DB
      .prepare('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?')
      .bind('generating_contexts', Date.now(), documentId)
      .run();
  }

  private async extractKeywords(documentId: string, summary: string): Promise<void> {
    const prompt = `Extract 15-20 important keywords from this summary.

Summary: ${summary}

Focus on:
- Proper nouns
- Technical terms
- Key concepts
- Dates/numbers with context

Return ONLY a JSON array: ["keyword1", "keyword2", ...]`;

    const gemini = new GeminiClient(this.env.GEMINI_API_KEY);
    
    let keywords: string[];
    try {
      keywords = await gemini.generateJSON<string[]>(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });
    } catch (error) {
      console.error('Failed to parse keywords:', error);
      keywords = [];
    }

    const keywordsId = `${documentId}-keywords`;
    await this.env.DB
      .prepare('INSERT OR REPLACE INTO document_keywords (id, document_id, keywords) VALUES (?, ?, ?)')
      .bind(keywordsId, documentId, JSON.stringify(keywords))
      .run();
  }

  private async getDocument(documentId: string) {
    return await this.env.DB
      .prepare('SELECT * FROM documents WHERE id = ?')
      .bind(documentId)
      .first();
  }
}
