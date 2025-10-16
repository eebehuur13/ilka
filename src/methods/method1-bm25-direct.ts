import type { Env, Answer, QueryAnalysis } from '../types';
import { BM25Retriever } from '../retrieval/bm25';
import { Reranker } from '../retrieval/reranker';
import { WriterAgent } from '../agents/writer';

export class Method1BM25Direct {
  private bm25: BM25Retriever;
  private reranker: Reranker;
  private writer: WriterAgent;

  constructor(private readonly env: Env) {
    this.bm25 = new BM25Retriever(env.DB);
    this.reranker = new Reranker(env.OPENAI_API_KEY, env.AI);
    this.writer = new WriterAgent(env);
  }

  async execute(query: string, analysis: QueryAnalysis, userId: string): Promise<Answer> {
    const startTime = Date.now();

    const normalizedQuery = this.bm25.preprocessQuery(query);
    let bm25Results = await this.bm25.search(normalizedQuery, { topK: 100, userId });

    if (bm25Results.length === 0) {
      const fuzzyResult = await this.bm25.fuzzySearch(query, { userId });
      if (fuzzyResult) {
        bm25Results = fuzzyResult.results;
      }
    }

    const reranked = await this.reranker.embeddingRerank(query, bm25Results.slice(0, 50), 0.7);
    const top20 = reranked.slice(0, 20);

    const answer = await this.writer.write(query, top20);

    return {
      ...answer,
      method: 'method1-bm25-direct',
      latency_ms: Date.now() - startTime
    };
  }
}
