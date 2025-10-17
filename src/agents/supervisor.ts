import type { Env, AgentDecision, ScoredPassage } from '../types';

export class SupervisorAgent {
  constructor(private readonly env: Env) {}

  async decide(
    query: string,
    passages: ScoredPassage[],
    round: number,
    answer?: { passed: boolean; issues: string[] }
  ): Promise<AgentDecision> {
    if (passages.length === 0) {
      return {
        action: 'requery',
        reasoning: 'No passages found'
      };
    }

    if (round >= 2) {
      return {
        action: 'proceed',
        reasoning: 'Maximum widening rounds reached'
      };
    }

    // Check answer quality first if available
    if (answer) {
      if (answer.passed) {
        return {
          action: 'proceed',
          reasoning: 'Answer passed verification'
        };
      }
      
      // Answer failed verification - should we widen?
      if (answer.issues.includes('No citations found') || answer.issues.includes('Answer too short')) {
        return {
          action: 'widen',
          strategy: 'heading-bounded',
          reasoning: `Answer verification failed: ${answer.issues.join(', ')}. Expanding context.`
        };
      }
      
      if (answer.issues.some(i => i.includes('Low citation rate'))) {
        return {
          action: 'widen',
          strategy: 'sliding-window',
          reasoning: 'Low citation rate, expanding to adjacent passages'
        };
      }
    }

    // Fallback to passage-based heuristics
    if (passages.length < 5 || passages[0].score < 3.0) {
      return {
        action: 'widen',
        strategy: 'heading-bounded',
        reasoning: 'Weak signal or insufficient passages, expand to section'
      };
    }

    return {
      action: 'proceed',
      reasoning: 'Acceptable results'
    };
  }
}
