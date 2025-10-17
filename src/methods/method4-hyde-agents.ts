import type { Env, Answer, QueryAnalysis } from '../types';
import { VectorRetriever } from '../retrieval/vector';
import { SupervisorAgent } from '../agents/supervisor';
import { ContextMakerAgent } from '../agents/context-maker';
import { WriterAgent } from '../agents/writer';
import { GeminiClient } from '../llm/gemini-client';
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

    // Answer-based feedback loop: generate answer, verify, then decide whether to widen
    let answer = await this.writer.write(query, topPassages);
    let verification = await this.verifier.verify(answer, topPassages);

    while (round < 3 && !verification.passed) {
      const decision = await this.supervisor.decide(query, topPassages, round, verification);

      if (decision.action === 'proceed') {
        // Supervisor decided to proceed despite failed verification
        break;
      }

      if (decision.action === 'widen' && decision.strategy) {
        topPassages = await this.contextMaker.widen(topPassages, decision.strategy);
        round++;
        
        // Regenerate answer with wider context
        answer = await this.writer.write(query, topPassages);
        verification = await this.verifier.verify(answer, topPassages);
      } else {
        break;
      }
    }

    return {
      ...answer,
      method: 'method4-hyde-agents',
      latency_ms: Date.now() - startTime,
      metadata: { 
        rounds: round, 
        verification: verification, 
        hyde_doc: hydeDoc,
        final_passage_count: topPassages.length
      }
    };
  }

  private async generateHydeDocument(query: string): Promise<string> {
    const prompt = `Generate a 2-3 sentence hypothetical answer to this question:

Question: ${query}

Write as if you're answering from a real document. Be specific and factual in tone.`;

    const gemini = new GeminiClient(this.env.GEMINI_API_KEY);
    const result = await gemini.generateContent(prompt, {
      temperature: 0.5,
      maxTokens: 300,
      thinkingBudget: 0,
    });

    return result.answer;
  }
}
