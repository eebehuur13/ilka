import type { Env, GeneratedContext } from '../types';

export class ContextEnricher {
  private readonly batchSize = 20;

  constructor(private readonly env: Env) {}

  async generateContexts(documentId: string): Promise<void> {
    const doc = await this.getDocument(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const summary = await this.getSummary(documentId);
    const passages = await this.getPassages(documentId);

    if (passages.length === 0) return;

    const batches = this.createBatches(passages);
    const allContexts: GeneratedContext[] = [];

    for (const batch of batches) {
      const contexts = await this.generateContextBatch(
        batch,
        doc.file_name as string,
        summary
      );
      allContexts.push(...contexts);
    }

    await this.saveContexts(allContexts);

    await this.env.DB
      .prepare('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?')
      .bind('embedding', Date.now(), documentId)
      .run();
  }

  private createBatches(passages: any[]): any[][] {
    const batches: any[][] = [];
    for (let i = 0; i < passages.length; i += this.batchSize) {
      batches.push(passages.slice(i, i + this.batchSize));
    }
    return batches;
  }

  private async generateContextBatch(
    batch: any[],
    fileName: string,
    summary: string
  ): Promise<GeneratedContext[]> {
    const chunkPreviews = batch.map((p, idx) => {
      const preview = (p.text as string).substring(0, 200);
      return `${idx + 1}. ${preview}`;
    }).join('\n\n');

    const prompt = `Generate a 1-2 sentence context for each chunk below.

Document: ${fileName}
Summary: ${summary}

Chunks:
${chunkPreviews}

For each chunk, provide context that situates it within the document.

Return JSON array:
[
  {"chunk_index": 1, "context": "..."},
  {"chunk_index": 2, "context": "..."},
  ...
]`;

    const response = await this.env.AI.run('@cf/openai/gpt-oss-120b', {
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: 2000,
      temperature: 0.4
    });

    let parsed: Array<{ chunk_index: number; context: string }>;
    try {
      const text = (response as any).output?.[0]?.content?.[0]?.text || (response as any).response || '';
      const jsonMatch = text.match(/\[.*\]/s);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
      console.error('Failed to parse contexts:', error);
      parsed = batch.map((_, idx) => ({
        chunk_index: idx + 1,
        context: `This passage is from ${fileName}.`
      }));
    }

    return batch.map((passage, idx) => {
      const contextObj = parsed.find(c => c.chunk_index === idx + 1);
      const context = contextObj?.context || `This passage is from ${fileName}.`;
      
      return {
        passage_id: passage.id as string,
        context
      };
    });
  }

  private async saveContexts(contexts: GeneratedContext[]): Promise<void> {
    const statements: D1PreparedStatement[] = [];

    for (const ctx of contexts) {
      const passage = await this.env.DB
        .prepare('SELECT text FROM passages WHERE id = ?')
        .bind(ctx.passage_id)
        .first();

      if (passage) {
        const contextualizedText = `${ctx.context}\n\n${passage.text}`;
        const contextId = `${ctx.passage_id}-context`;
        
        statements.push(
          this.env.DB.prepare(`
            INSERT OR REPLACE INTO chunk_contexts (id, passage_id, context_text, contextualized_text)
            VALUES (?, ?, ?, ?)
          `).bind(contextId, ctx.passage_id, ctx.context, contextualizedText)
        );
      }
    }

    // D1 batch limit is 50 statements - chunk into batches
    const batchSize = 50;
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);
      await this.env.DB.batch(batch);
    }
  }

  private async getDocument(documentId: string) {
    return await this.env.DB
      .prepare('SELECT * FROM documents WHERE id = ?')
      .bind(documentId)
      .first();
  }

  private async getSummary(documentId: string): Promise<string> {
    const result = await this.env.DB
      .prepare('SELECT summary_text FROM document_summaries WHERE document_id = ?')
      .bind(documentId)
      .first();
    
    return result?.summary_text as string || '';
  }

  private async getPassages(documentId: string) {
    const result = await this.env.DB
      .prepare('SELECT id, text FROM passages WHERE document_id = ? ORDER BY passage_index')
      .bind(documentId)
      .all();
    
    return result.results || [];
  }
}
