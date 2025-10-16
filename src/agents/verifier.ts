import type { Env, Answer } from '../types';

export class VerifierAgent {
  constructor(private readonly env: Env) {}

  async verify(answer: Answer): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (answer.citations.length === 0) {
      issues.push('No citations found');
    }

    if (answer.text.length < 50) {
      issues.push('Answer too short');
    }

    const sentences = answer.text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const citedSentences = sentences.filter(s => /\[\d+\]/.test(s)).length;
    const citationRate = citedSentences / sentences.length;

    if (citationRate < 0.5) {
      issues.push(`Low citation rate: ${Math.round(citationRate * 100)}%`);
    }

    if (answer.text.toLowerCase().includes("i don't know") && answer.text.length < 100) {
      issues.push('Answer indicates lack of information');
    }

    const passed = issues.length === 0;
    return { passed, issues };
  }
}
