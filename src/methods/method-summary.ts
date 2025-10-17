import type { Env, Answer, QueryAnalysis } from '../types';
import { GeminiClient } from '../llm/gemini-client';
import { truncateToTokenLimit } from '../utils/tokenizer';

export class MethodSummary {
  constructor(private readonly env: Env) {}

  async execute(query: string, analysis: QueryAnalysis, userId: string): Promise<Answer> {
    const startTime = Date.now();

    // Get user's documents
    const documents = await this.env.DB
      .prepare('SELECT id, file_name, full_text, status FROM documents WHERE user_id = ? ORDER BY upload_date DESC')
      .bind(userId)
      .all();

    if (!documents.results || documents.results.length === 0) {
      return {
        method: 'method-summary',
        text: '**No documents found**\n\nPlease upload documents before requesting a summary.',
        citations: [],
        confidence: 'high',
        latency_ms: Date.now() - startTime
      };
    }

    // Determine target document(s)
    let targetDocs = documents.results;
    
    if (analysis.target_document) {
      // User specified a specific document
      targetDocs = documents.results.filter((doc: any) => 
        doc.file_name.toLowerCase().includes(analysis.target_document!.toLowerCase())
      );
      
      if (targetDocs.length === 0) {
        return {
          method: 'method-summary',
          text: `**Document not found**\n\nCould not find a document matching "${analysis.target_document}". Available documents:\n${documents.results.map((d: any) => `- ${d.file_name}`).join('\n')}`,
          citations: [],
          confidence: 'high',
          latency_ms: Date.now() - startTime
        };
      }
    } else if (documents.results.length > 5) {
      // Too many documents, use only first 5
      targetDocs = documents.results.slice(0, 5);
    }

    // Retrieve or generate summaries
    const summaries = await Promise.all(
      targetDocs.map(async (doc: any) => {
        // Check if document is ready
        if (doc.status !== 'ready') {
          return {
            file_name: doc.file_name,
            summary: `*Document is still processing (status: ${doc.status}). Summary will be available shortly.*`,
            document_id: doc.id,
            confidence: 'low',
            from_db: false
          };
        }

        // Try to get pre-generated summary
        const existingSummary = await this.env.DB
          .prepare('SELECT summary_text FROM document_summaries WHERE document_id = ?')
          .bind(doc.id)
          .first();

        if (existingSummary && existingSummary.summary_text) {
          return {
            file_name: doc.file_name as string,
            summary: existingSummary.summary_text as string,
            document_id: doc.id as string,
            confidence: 'high' as const,
            from_db: true
          };
        }

        // No pre-generated summary, create one on-the-fly
        const summary = await this.generateSummary(doc);
        return {
          file_name: doc.file_name as string,
          summary,
          document_id: doc.id as string,
          confidence: 'medium' as const,
          from_db: false
        };
      })
    );

    // Format response
    let text = '';
    const citations = [];

    if (summaries.length === 1) {
      // Single document
      const s = summaries[0];
      text = `## Summary: ${s.file_name}\n\n${s.summary}`;
      citations.push({
        file_name: s.file_name,
        start_line: 1,
        end_line: 999999,
        text: s.summary.substring(0, 200) + '...'
      });
    } else {
      // Multiple documents
      text = `## Summary of ${summaries.length} Documents\n\n`;
      for (const s of summaries) {
        text += `### ${s.file_name}\n\n${s.summary}\n\n---\n\n`;
        citations.push({
          file_name: s.file_name,
          start_line: 1,
          end_line: 999999,
          text: s.summary.substring(0, 200) + '...'
        });
      }
    }

    // Determine overall confidence
    const allHigh = summaries.every(s => s.confidence === 'high');
    const anyLow = summaries.some(s => s.confidence === 'low');
    const confidence = anyLow ? 'low' : (allHigh ? 'high' : 'medium');

    return {
      method: 'method-summary',
      text,
      citations,
      confidence,
      latency_ms: Date.now() - startTime,
      metadata: {
        document_count: summaries.length,
        from_cache: summaries.filter(s => s.from_db).length,
        generated_on_fly: summaries.filter(s => !s.from_db).length
      }
    };
  }

  private async generateSummary(doc: any): Promise<string> {
    if (!doc.full_text) {
      return '*Document has no content to summarize.*';
    }

    const textToSummarize = truncateToTokenLimit(doc.full_text, 50000);

    const prompt = `Summarize this document comprehensively in 500-800 words.

Document: ${doc.file_name}
Content: ${textToSummarize}

Include:
- Main topic and purpose
- Key sections and themes
- Important entities (people, organizations, dates, numbers)
- Document type/category

Write factually, third-person.`;

    try {
      const gemini = new GeminiClient(this.env.GEMINI_API_KEY);
      const result = await gemini.generateContent(prompt, {
        temperature: 0.3,
        maxTokens: 2000,
        thinkingBudget: 0,
      });

      const summary = result.answer;
      
      if (!summary) {
        return '*Failed to generate summary: empty response from AI.*';
      }

      return summary;
    } catch (error: any) {
      console.error('Summary generation error:', error);
      return `*Failed to generate summary: ${error.message}*`;
    }
  }
}
