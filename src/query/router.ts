import type { QueryAnalysis, RetrievalMethod } from '../types';

export class Router {
  route(analysis: QueryAnalysis): RetrievalMethod[] {
    const { complexity, intent, target_type } = analysis;

    // Check analyzer recommendations FIRST
    if (analysis.recommended_methods && analysis.recommended_methods.length > 0) {
      return analysis.recommended_methods;
    }

    if (complexity === 'simple' && intent === 'factual') {
      return ['bm25'];
    }

    if (complexity === 'moderate') {
      return ['bm25', 'vector'];
    }

    if (complexity === 'complex' || intent === 'analytical' || intent === 'comparison') {
      return ['bm25', 'vector', 'hyde'];
    }

    return ['bm25', 'vector'];
  }

  shouldRunInParallel(methods: RetrievalMethod[]): boolean {
    return methods.length > 1;
  }
}
