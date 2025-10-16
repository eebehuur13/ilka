import type { QueryAnalysis, RetrievalMethod } from '../types';

export class Router {
  route(analysis: QueryAnalysis): RetrievalMethod[] {
    const { complexity, intent, target_type } = analysis;

    if (complexity === 'simple' && intent === 'factual') {
      return ['bm25'];
    }

    if (target_type === 'specific_doc' && intent === 'summary') {
      return ['summary'];
    }

    if (complexity === 'moderate') {
      return ['bm25', 'vector'];
    }

    if (complexity === 'complex' || intent === 'analytical' || intent === 'comparison') {
      return ['bm25', 'vector', 'hyde'];
    }

    if (analysis.recommended_methods && analysis.recommended_methods.length > 0) {
      return analysis.recommended_methods;
    }

    return ['bm25', 'vector'];
  }

  shouldRunInParallel(methods: RetrievalMethod[]): boolean {
    return methods.length > 1;
  }
}
