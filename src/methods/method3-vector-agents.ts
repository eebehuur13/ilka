import type { Env, Answer, QueryAnalysis } from '../types';
import { VectorRetriever } from '../retrieval/vector';
import { Reranker } from '../retrieval/reranker';
import { SupervisorAgent } from '../agents/supervisor';
import { ContextMakerAgent } from '../agents/context-maker';
import { WriterAgent } from '../agents/writer';
import { VerifierAgent } from '../agents/verifier';

export class Method3VectorAgents {
  private vector: VectorRetriever;
  private reranker: Reranker;
  private supervisor: SupervisorAgent;
  private contextMaker: ContextMakerAgent;
  private writer: WriterAgent;
  private verifier: VerifierAgent;

  constructor(private readonly env: Env) {
    this.vector = new VectorRetriever(env.VECTORIZE, env.OPENAI_API_KEY, env.DB);
    this.reranker = new Reranker(env.OPENAI_API_KEY, env.AI);
    this.supervisor = new SupervisorAgent(env);
    this.contextMaker = new ContextMakerAgent(env);
    this.writer = new WriterAgent(env);
    this.verifier = new VerifierAgent(env);
  }

  async execute(query: string, analysis: QueryAnalysis, userId: string): Promise<Answer> {
    const startTime = Date.now();
    let round = 0;

    let vectorResults = await this.vector.search(query, {
      top_k: 50,
      namespace: `user-${userId}`
    });

    let topPassages = vectorResults.slice(0, 20);

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
        method: 'method3-vector-agents',
        latency_ms: Date.now() - startTime,
        metadata: { rounds: round + 1, verification_retry: true }
      };
    }

    return {
      ...answer,
      method: 'method3-vector-agents',
      latency_ms: Date.now() - startTime,
      metadata: { rounds: round, verification: verification }
    };
  }
}
