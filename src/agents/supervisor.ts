import type { Env, AgentDecision, ScoredPassage } from '../types';

export class SupervisorAgent {
  constructor(private readonly env: Env) {}

  async decide(
    query: string,
    passages: ScoredPassage[],
    round: number
  ): Promise<AgentDecision> {
    if (passages.length === 0) {
      return {
        action: 'requery',
        reasoning: 'No passages found'
      };
    }

    if (passages.length >= 10 && passages[0].score > 5.0) {
      return {
        action: 'proceed',
        reasoning: 'Strong signal with sufficient passages'
      };
    }

    if (round >= 2) {
      return {
        action: 'proceed',
        reasoning: 'Maximum widening rounds reached'
      };
    }

    if (passages.length < 5 || passages[0].score < 3.0) {
      return {
        action: 'widen',
        strategy: 'heading-bounded',
        reasoning: 'Weak signal or insufficient passages, expand to full section'
      };
    }

    return {
      action: 'proceed',
      reasoning: 'Acceptable results'
    };
  }
}
