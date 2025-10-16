import type { Env, ScoredPassage, VectorSearchOptions } from '../types';

export class VectorRetriever {
  constructor(
    private readonly vectorize: VectorizeIndex,
    private readonly openaiApiKey: string,
    private readonly db: D1Database
  ) {}

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: 1536
        })
      })
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API: missing embedding data')
      }
      
      return data.data[0].embedding
    } catch (error) {
      console.error('Embedding error:', error)
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
          dimensions: 1536
        })
      })
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response from OpenAI API: missing embedding data array')
      }
      
      return data.data.map((item: any) => {
        if (!item.embedding) {
          throw new Error('Invalid response from OpenAI API: missing embedding in item')
        }
        return item.embedding
      })
    } catch (error) {
      console.error('Batch embedding error:', error)
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async upsertPassage(
    passageId: string,
    text: string,
    contextText: string,
    metadata: {
      document_id: string;
      file_name: string;
      passage_index: number;
      heading: string | null;
      start_line: number;
      end_line: number;
    },
    namespace?: string
  ): Promise<void> {
    const fullText = contextText ? `${contextText}\n\n${text}` : text;
    const embedding = await this.embed(fullText);
    
    await this.vectorize.upsert([{
      id: passageId,
      values: embedding,
      namespace: namespace || 'default',
      metadata: {
        ...metadata,
        original_text: text,
        contextualized_text: fullText
      }
    }]);
  }

  async upsertBatch(
    passages: Array<{
      id: string;
      text: string;
      contextText: string;
      metadata: any;
    }>,
    namespace?: string
  ): Promise<void> {
    const texts = passages.map(p => 
      p.contextText ? `${p.contextText}\n\n${p.text}` : p.text
    );
    
    const embeddings = await this.embedBatch(texts);
    
    const vectors = passages.map((passage, idx) => ({
      id: passage.id,
      values: embeddings[idx],
      namespace: namespace || 'default',
      metadata: {
        ...passage.metadata,
        original_text: passage.text,
        contextualized_text: texts[idx]
      }
    }));
    
    await this.vectorize.upsert(vectors);
  }

  async search(
    query: string,
    options: VectorSearchOptions
  ): Promise<ScoredPassage[]> {
    const queryEmbedding = await this.embed(query);
    
    const results = await this.vectorize.query(queryEmbedding, {
      topK: options.top_k,
      namespace: options.namespace || 'default',
      filter: options.filter,
      returnMetadata: 'all'
    });

    const passageIds = results.matches.map(m => m.id);
    if (passageIds.length === 0) return [];

    const placeholders = passageIds.map(() => '?').join(',');
    const passagesQuery = `
      SELECT 
        p.id,
        p.document_id,
        p.passage_index,
        p.start_line,
        p.end_line,
        p.heading,
        p.heading_level,
        p.parent_section_id,
        p.text,
        p.word_count,
        p.token_count,
        p.created_at
      FROM passages p
      WHERE p.id IN (${placeholders})
    `;

    const passagesResult = await this.db
      .prepare(passagesQuery)
      .bind(...passageIds)
      .all();

    const passageMap = new Map(
      passagesResult.results?.map(p => [p.id as string, p]) || []
    );

    return results.matches
      .map(match => {
        const passage = passageMap.get(match.id);
        if (!passage) return null;

        return {
          id: passage.id as string,
          document_id: passage.document_id as string,
          passage_index: passage.passage_index as number,
          start_line: passage.start_line as number,
          end_line: passage.end_line as number,
          heading: passage.heading as string | null,
          heading_level: passage.heading_level as number | null,
          parent_section_id: passage.parent_section_id as string | null,
          text: passage.text as string,
          word_count: passage.word_count as number,
          token_count: passage.token_count as number,
          created_at: passage.created_at as number,
          score: match.score
        };
      })
      .filter((p): p is ScoredPassage => p !== null);
  }

  async deleteDocumentVectors(documentId: string, namespace?: string): Promise<void> {
    const passagesQuery = 'SELECT id FROM passages WHERE document_id = ?';
    const passages = await this.db.prepare(passagesQuery).bind(documentId).all();
    
    if (!passages.results || passages.results.length === 0) return;

    const ids = passages.results.map(p => p.id as string);
    
    // Delete from the specified namespace (or default if not provided)
    for (const id of ids) {
      await this.vectorize.deleteByIds([id], { namespace: namespace || 'default' });
    }
  }
}
