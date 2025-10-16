import type { ScoredPassage, Env } from '../types';

export class Reranker {
  constructor(
    private readonly openaiApiKey: string,
    private readonly ai: Ai
  ) {}

  async embeddingRerank(
    query: string,
    passages: ScoredPassage[],
    bm25Weight: number = 0.7
  ): Promise<ScoredPassage[]> {
    if (passages.length === 0) return [];

    const queryEmbedding = await this.embed(query);
    const passageTexts = passages.map(p => p.text);
    const passageEmbeddings = await this.embedBatch(passageTexts);

    return passages.map((passage, idx) => {
      const cosineSim = this.cosineSimilarity(queryEmbedding, passageEmbeddings[idx]);
      const combinedScore = bm25Weight * passage.score + (1 - bm25Weight) * cosineSim * 10;
      
      return {
        ...passage,
        score: combinedScore
      };
    }).sort((a, b) => b.score - a.score);
  }

  async crossEncoderRerank(
    query: string,
    passages: ScoredPassage[]
  ): Promise<ScoredPassage[]> {
    if (passages.length === 0) return [];

    try {
      const response = await this.ai.run('@cf/baai/bge-reranker-base', {
        query,
        texts: passages.map(p => p.text.substring(0, 512))
      });

      const scores = (response as any).data;

      return passages.map((passage, idx) => ({
        ...passage,
        score: scores[idx]
      })).sort((a, b) => b.score - a.score);
      
    } catch (error) {
      console.error('Cross-encoder reranking failed, returning original order:', error);
      return passages;
    }
  }

  private async embed(text: string): Promise<number[]> {
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
      console.error('Reranker embedding error:', error)
      throw new Error(`Failed to generate embedding for reranking: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
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
      console.error('Reranker batch embedding error:', error)
      throw new Error(`Failed to generate batch embeddings for reranking: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
