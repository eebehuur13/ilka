import type { Env } from '../types';
import { VectorRetriever } from '../retrieval/vector';

export class DocumentEmbedder {
  private vector: VectorRetriever;

  constructor(private readonly env: Env) {
    this.vector = new VectorRetriever(env.VECTORIZE, env.OPENAI_API_KEY, env.DB);
  }

  async embedDocument(documentId: string, userId: string): Promise<void> {
    const doc = await this.getDocument(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const passages = await this.getPassagesWithContexts(documentId);

    const batchSize = 100;
    for (let i = 0; i < passages.length; i += batchSize) {
      const batch = passages.slice(i, i + batchSize);
      
      await this.vector.upsertBatch(
        batch.map(p => ({
          id: p.id as string,
          text: p.text as string,
          contextText: (p.context_text as string) || '',
          metadata: {
            document_id: documentId,
            file_name: doc.file_name as string,
            passage_index: p.passage_index as number,
            heading: p.heading as string | null,
            start_line: p.start_line as number,
            end_line: p.end_line as number
          }
        })),
        `user-${userId}`
      );
    }

    await this.env.DB
      .prepare('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?')
      .bind('ready', Date.now(), documentId)
      .run();
  }

  async embedDocumentBatch(
    documentId: string,
    userId: string,
    startIndex: number,
    endIndex: number,
    batchIndex: number,
    totalBatches: number
  ): Promise<void> {
    const doc = await this.getDocument(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const allPassages = await this.getPassagesWithContexts(documentId);
    const passages = allPassages.slice(startIndex, endIndex);

    console.log(`[Batch ${batchIndex + 1}/${totalBatches}] Embedding chunks ${startIndex}-${endIndex} for doc ${documentId}`);

    await this.vector.upsertBatch(
      passages.map(p => ({
        id: p.id as string,
        text: p.text as string,
        contextText: (p.context_text as string) || '',
        metadata: {
          document_id: documentId,
          file_name: doc.file_name as string,
          passage_index: p.passage_index as number,
          heading: p.heading as string | null,
          start_line: p.start_line as number,
          end_line: p.end_line as number
        }
      })),
      `user-${userId}`
    );

    // Only the last batch updates status to "ready"
    if (batchIndex === totalBatches - 1) {
      console.log(`[Batch ${batchIndex + 1}/${totalBatches}] Final batch complete - marking document as ready`);
      await this.env.DB
        .prepare('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?')
        .bind('ready', Date.now(), documentId)
        .run();
    }
  }

  private async getDocument(documentId: string) {
    return await this.env.DB
      .prepare('SELECT * FROM documents WHERE id = ?')
      .bind(documentId)
      .first();
  }

  private async getPassagesWithContexts(documentId: string) {
    const result = await this.env.DB
      .prepare(`
        SELECT 
          p.id,
          p.passage_index,
          p.heading,
          p.start_line,
          p.end_line,
          p.text,
          c.context_text
        FROM passages p
        LEFT JOIN chunk_contexts c ON c.passage_id = p.id
        WHERE p.document_id = ?
        ORDER BY p.passage_index
      `)
      .bind(documentId)
      .all();
    
    return result.results || [];
  }
}
