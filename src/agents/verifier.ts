import type { Env, Answer, ScoredPassage } from '../types';

export class VerifierAgent {
  constructor(private readonly env: Env) {}

  async verify(answer: Answer, passages?: ScoredPassage[]): Promise<{ passed: boolean; issues: string[] }> {
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

    // Validate citations reference valid passages
    if (passages && passages.length > 0) {
      const citationMatches = answer.text.match(/\[(\d+)\]/g) || [];
      const citedIndices = citationMatches.map(m => parseInt(m.replace(/\[|\]/g, '')) - 1);
      
      const invalidCitations = citedIndices.filter(idx => idx < 0 || idx >= passages.length);
      if (invalidCitations.length > 0) {
        issues.push(`Invalid citation indices: ${invalidCitations.map(i => `[${i + 1}]`).join(', ')}`);
      }
    }

    const passed = issues.length === 0;
    return { passed, issues };
  }
}
