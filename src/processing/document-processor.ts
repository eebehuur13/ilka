import type { Env, Document, Passage, ChunkBoundary } from '../types';
import { HierarchicalChunker } from '../utils/chunker';
import { BM25Retriever } from '../retrieval/bm25';

export class DocumentProcessor {
  private chunker: HierarchicalChunker;
  private bm25: BM25Retriever;

  constructor(private readonly env: Env) {
    this.chunker = new HierarchicalChunker();
    this.bm25 = new BM25Retriever(env.DB);
  }

  async processDocument(documentId: string): Promise<void> {
    await this.updateStatus(documentId, 'chunking');
    
    const doc = await this.getDocument(documentId);
    if (!doc || !doc.full_text) {
      throw new Error(`Document ${documentId} not found or has no text`);
    }

    const chunks = this.chunker.chunk(doc.full_text);
    
    await this.savePassages(documentId, chunks);
    await this.updateStatus(documentId, 'indexing_bm25');
    
    // Clean up any old index data before re-indexing (prevents duplicate accumulation on retries)
    await this.bm25.deleteDocumentIndex(documentId);
    
    const passages = await this.getPassages(documentId);
    await this.bm25.indexDocument(documentId, doc.user_id, passages);
    
    await this.env.DB
      .prepare('UPDATE documents SET chunk_count = ?, status = ? WHERE id = ?')
      .bind(chunks.length, 'generating_summary', documentId)
      .run();
  }

  private async savePassages(documentId: string, chunks: ChunkBoundary[]): Promise<void> {
    const statements: D1PreparedStatement[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const passageId = `${documentId}-p${i}`;
      
      statements.push(
        this.env.DB.prepare(`
          INSERT OR REPLACE INTO passages (
            id, document_id, passage_index, start_line, end_line,
            heading, heading_level, parent_section_id, text, word_count, token_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          passageId,
          documentId,
          i,
          chunk.start_line,
          chunk.end_line,
          chunk.heading,
          chunk.heading_level,
          chunk.parent_section_id,
          chunk.text,
          chunk.word_count,
          chunk.token_count
        )
      );
    }

    // D1 batch limit is 50 statements - chunk into batches
    const batchSize = 50;
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);
      await this.env.DB.batch(batch);
    }
  }

  private async getDocument(documentId: string): Promise<Document | null> {
    const result = await this.env.DB
      .prepare('SELECT * FROM documents WHERE id = ?')
      .bind(documentId)
      .first();
    
    return result as Document | null;
  }

  private async getPassages(documentId: string): Promise<Array<{
    id: string;
    text: string;
    word_count: number;
    heading: string | null;
  }>> {
    const result = await this.env.DB
      .prepare('SELECT id, text, word_count, heading FROM passages WHERE document_id = ? ORDER BY passage_index')
      .bind(documentId)
      .all();
    
    return result.results as any[];
  }

  private async updateStatus(documentId: string, status: string): Promise<void> {
    await this.env.DB
      .prepare('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, Date.now(), documentId)
      .run();
  }
}
