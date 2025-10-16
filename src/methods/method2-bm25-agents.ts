import type { Env, Answer, QueryAnalysis } from '../types';
import { BM25Retriever } from '../retrieval/bm25';
import { Reranker } from '../retrieval/reranker';
import { SupervisorAgent } from '../agents/supervisor';
import { ContextMakerAgent } from '../agents/context-maker';
import { WriterAgent } from '../agents/writer';
import { VerifierAgent } from '../agents/verifier';

export class Method2BM25Agents {
  private bm25: BM25Retriever;
  private reranker: Reranker;
  private supervisor: SupervisorAgent;
  private contextMaker: ContextMakerAgent;
  private writer: WriterAgent;
  private verifier: VerifierAgent;

  constructor(private readonly env: Env) {
    this.bm25 = new BM25Retriever(env.DB);
    this.reranker = new Reranker(env.OPENAI_API_KEY, env.AI);
    this.supervisor = new SupervisorAgent(env);
    this.contextMaker = new ContextMakerAgent(env);
    this.writer = new WriterAgent(env);
    this.verifier = new VerifierAgent(env);
  }

  async execute(query: string, analysis: QueryAnalysis, userId: string): Promise<Answer> {
    const startTime = Date.now();
    let round = 0;

    const normalizedQuery = this.bm25.preprocessQuery(query);
    let bm25Results = await this.bm25.search(normalizedQuery, { topK: 100, userId });

    if (bm25Results.length === 0) {
      const fuzzyResult = await this.bm25.fuzzySearch(query, { userId });
      if (fuzzyResult) {
        bm25Results = fuzzyResult.results;
      }
    }

    let reranked = await this.reranker.embeddingRerank(query, bm25Results.slice(0, 50), 0.7);
    let topPassages = reranked.slice(0, 20);

    while (round < 2) {
      const decision = await this.supervisor.decide(query, topPassages, round);

      if (decision.action === 'proceed') break;

      if (decision.action === 'widen' && decision.strategy) {
        topPassages = await this.contextMaker.widen(topPassages, decision.strategy);
        round++;
      } else {
        break;
      }
    }

    const answer = await this.writer.write(query, topPassages);
    const verification = await this.verifier.verify(answer);

    if (!verification.passed && round < 2) {
      topPassages = await this.contextMaker.widen(topPassages, 'full-section');
      const retryAnswer = await this.writer.write(query, topPassages);
      
      return {
        ...retryAnswer,
        method: 'method2-bm25-agents',
        latency_ms: Date.now() - startTime,
        metadata: { rounds: round + 1, verification_retry: true }
      };
    }

    return {
      ...answer,
      method: 'method2-bm25-agents',
      latency_ms: Date.now() - startTime,
      metadata: { rounds: round, verification: verification }
    };
  }
}
