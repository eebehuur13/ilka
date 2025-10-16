import type { Env, Answer, QueryAnalysis } from '../types';
import { VectorRetriever } from '../retrieval/vector';
import { SupervisorAgent } from '../agents/supervisor';
import { ContextMakerAgent } from '../agents/context-maker';
import { WriterAgent } from '../agents/writer';
import { VerifierAgent } from '../agents/verifier';

export class Method4HydeAgents {
  private vector: VectorRetriever;
  private supervisor: SupervisorAgent;
  private contextMaker: ContextMakerAgent;
  private writer: WriterAgent;
  private verifier: VerifierAgent;

  constructor(private readonly env: Env) {
    this.vector = new VectorRetriever(env.VECTORIZE, env.OPENAI_API_KEY, env.DB);
    this.supervisor = new SupervisorAgent(env);
    this.contextMaker = new ContextMakerAgent(env);
    this.writer = new WriterAgent(env);
    this.verifier = new VerifierAgent(env);
  }

  async execute(query: string, analysis: QueryAnalysis, userId: string): Promise<Answer> {
    const startTime = Date.now();

    const hydeDoc = analysis.hypothetical_answer || await this.generateHydeDocument(query);

    let vectorResults = await this.vector.search(hydeDoc, {
      top_k: 50,
      namespace: `user-${userId}`
    });

    let round = 0;
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
        method: 'method4-hyde-agents',
        latency_ms: Date.now() - startTime,
        metadata: { rounds: round + 1, verification_retry: true, hyde_doc: hydeDoc }
      };
    }

    return {
      ...answer,
      method: 'method4-hyde-agents',
      latency_ms: Date.now() - startTime,
      metadata: { rounds: round, verification: verification, hyde_doc: hydeDoc }
    };
  }

  private async generateHydeDocument(query: string): Promise<string> {
    const prompt = `Generate a 2-3 sentence hypothetical answer to this question:

Question: ${query}

Write as if you're answering from a real document. Be specific and factual in tone.`;

    const response = await this.env.AI.run('@cf/openai/gpt-oss-120b', {
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: 300,
      temperature: 0.5
    });

    return (response as any).output?.[0]?.content?.[0]?.text || (response as any).response || '';
  }
}
