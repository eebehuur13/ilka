import type { Env, ScoredPassage, BM25Params } from '../types';

export class BM25Retriever {
  private readonly params: BM25Params = {
    k1: 1.5,
    b: 0.4,
    rare_term_idf_threshold: 4.0,
    rare_term_boost: 1.5
  };
  
  private readonly minTermLength = 2;
  private readonly maxLevenshteinDistance = 2;
  
  private stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have',
    'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how'
  ]);

  constructor(private readonly db: D1Database) {}

  async indexDocument(documentId: string, passages: Array<{
    id: string;
    text: string;
    word_count: number;
    heading: string | null;
  }>): Promise<void> {
    if (passages.length === 0) return;

    const termIndex = new Map<string, Map<string, number>>();
    const documentFrequency = new Map<string, Set<string>>();
    const positionWeights = new Map<string, Map<string, number>>();

    for (const passage of passages) {
      const terms = this.tokenize(passage.text);
      const termCounts = this.countTerms(terms);
      
      // Calculate position weight (heading = 1.5, body = 1.0)
      const weight = passage.heading !== null ? 1.5 : 1.0;

      for (const [term, count] of termCounts.entries()) {
        if (!termIndex.has(term)) {
          termIndex.set(term, new Map());
          positionWeights.set(term, new Map());
        }
        termIndex.get(term)!.set(passage.id, count);
        positionWeights.get(term)!.set(passage.id, weight);

        if (!documentFrequency.has(term)) {
          documentFrequency.set(term, new Set());
        }
        documentFrequency.get(term)!.add(passage.id);
      }
    }

    // Get GLOBAL corpus passage count for correct IDF calculation
    const globalStats = await this.db
      .prepare('SELECT COUNT(*) as total FROM passages')
      .first();
    const totalPassages = (globalStats?.total as number) || passages.length;
    
    const avgLength = passages.reduce((sum, p) => sum + p.word_count, 0) / passages.length;
    const uniqueTerms = termIndex.size;
    const totalTerms = Array.from(termIndex.values())
      .reduce((sum, map) => sum + Array.from(map.values()).reduce((s, c) => s + c, 0), 0);

    const statements: D1PreparedStatement[] = [];

    // Insert term frequencies with position weights
    for (const [term, passageMap] of termIndex.entries()) {
      for (const [passageId, freq] of passageMap.entries()) {
        const weight = positionWeights.get(term)?.get(passageId) || 1.0;
        statements.push(
          this.db.prepare(
            'INSERT OR REPLACE INTO bm25_terms (term, document_id, passage_id, term_frequency, position_weight) VALUES (?, ?, ?, ?, ?)'
          ).bind(term, documentId, passageId, freq, weight)
        );
      }
    }

    // Insert/update IDF scores
    for (const [term, docSet] of documentFrequency.entries()) {
      const df = docSet.size;
      const idf = Math.log((totalPassages - df + 0.5) / (df + 0.5) + 1);
      
      statements.push(
        this.db.prepare(
          'INSERT OR REPLACE INTO bm25_idf (term, document_frequency, idf_score, updated_at) VALUES (?, ?, ?, ?)'
        ).bind(term, df, idf, Date.now())
      );
    }

    // Insert stats
    statements.push(
      this.db.prepare(
        'INSERT OR REPLACE INTO bm25_stats (document_id, total_passages, avg_passage_length, total_terms, unique_terms) VALUES (?, ?, ?, ?, ?)'
      ).bind(documentId, totalPassages, avgLength, totalTerms, uniqueTerms)
    );

    // D1 batch limit is 50 statements - chunk into batches
    const batchSize = 50;
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);
      await this.db.batch(batch);
    }
  }

  async search(
    query: string,
    options: {
      topK?: number;
      documentId?: string;
      userId?: string;
    } = {}
  ): Promise<ScoredPassage[]> {
    const topK = options.topK ?? 100;
    const normalizedQuery = this.preprocessQuery(query);
    const queryTerms = this.tokenize(normalizedQuery);
    
    if (queryTerms.length === 0) {
      return [];
    }

    const expandedTerms = this.expandQuery(queryTerms);
    const allTerms = [...new Set([...queryTerms, ...expandedTerms])];

    let candidateQuery = `
      SELECT 
        bt.passage_id,
        bt.term,
        bt.term_frequency,
        bt.position_weight,
        bi.idf_score,
        p.id,
        p.document_id,
        p.passage_index,
        p.start_line,
        p.end_line,
        p.heading,
        p.heading_level,
        p.parent_section_id,
        p.text,
        p.word_count,
        p.token_count,
        d.file_name
      FROM bm25_terms bt
      JOIN bm25_idf bi ON bi.term = bt.term
      JOIN passages p ON p.id = bt.passage_id
      JOIN documents d ON d.id = p.document_id
      WHERE bt.term IN (${allTerms.map(() => '?').join(',')})
    `;

    const bindings: any[] = [...allTerms];

    if (options.documentId) {
      candidateQuery += ' AND bt.document_id = ?';
      bindings.push(options.documentId);
    }

    if (options.userId) {
      candidateQuery += ' AND d.user_id = ?';
      bindings.push(options.userId);
    }

    const candidateResults = await this.db
      .prepare(candidateQuery)
      .bind(...bindings)
      .all();

    if (!candidateResults.results || candidateResults.results.length === 0) {
      return [];
    }

    // Get average doc length for scoring
    const statsQuery = options.documentId
      ? 'SELECT avg_passage_length FROM bm25_stats WHERE document_id = ? LIMIT 1'
      : 'SELECT AVG(avg_passage_length) as avg_passage_length FROM bm25_stats';
    
    const statsResult = options.documentId
      ? await this.db.prepare(statsQuery).bind(options.documentId).first()
      : await this.db.prepare(statsQuery).first();
    
    const avgDocLen = (statsResult?.avg_passage_length as number) ?? 500;

    const scores = this.computeBM25Scores(
      candidateResults.results,
      new Set(queryTerms),
      avgDocLen
    );

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  preprocessQuery(query: string): string {
    let normalized = query;
    
    // Split alphanumeric compounds: "NEP2020" → "NEP 2020"
    normalized = normalized.replace(/([a-zA-Z])(\d+)/g, '$1 $2');
    normalized = normalized.replace(/(\d+)([a-zA-Z])/g, '$1 $2');
    
    // Replace hyphens/underscores with spaces
    normalized = normalized.replace(/[-_]/g, ' ');
    
    // Collapse multiple spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }

  async fuzzySearch(
    query: string,
    options: { topK?: number; documentId?: string; userId?: string } = {}
  ): Promise<{ suggestion: string; results: ScoredPassage[] } | null> {
    const queryLower = query.toLowerCase();
    
    let termsQuery = 'SELECT DISTINCT term FROM bm25_terms';
    if (options.documentId) {
      termsQuery += ' WHERE document_id = ?';
    }
    
    const allTerms = options.documentId
      ? await this.db.prepare(termsQuery).bind(options.documentId).all()
      : await this.db.prepare(termsQuery).all();
    
    const closeMatches = (allTerms.results || [])
      .map(row => ({
        term: row.term as string,
        distance: this.levenshtein(queryLower, row.term as string)
      }))
      .filter(match => match.distance > 0 && match.distance <= this.maxLevenshteinDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    
    if (closeMatches.length > 0) {
      const suggestion = closeMatches[0].term;
      const results = await this.search(suggestion, options);
      return { suggestion, results };
    }
    
    return null;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => 
        token.length >= this.minTermLength && 
        !this.stopWords.has(token) &&
        !/^\d+$/.test(token)
      );
  }

  private countTerms(terms: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const term of terms) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    return counts;
  }

  private expandQuery(terms: string[]): string[] {
    const expanded: string[] = [];
    
    for (const term of terms) {
      // Plural/singular
      if (term.endsWith('s') && term.length > 3) {
        expanded.push(term.slice(0, -1));
      }
      if (!term.endsWith('s') && term.length > 2) {
        expanded.push(term + 's');
      }
      
      // Basic stemming
      if (term.endsWith('ing') && term.length > 5) {
        expanded.push(term.slice(0, -3));
      }
      if (term.endsWith('ed') && term.length > 4) {
        expanded.push(term.slice(0, -2));
      }
    }
    
    return expanded;
  }

  private computeBM25Scores(
    results: any[],
    queryTerms: Set<string>,
    avgDocLen: number
  ): ScoredPassage[] {
    const passageMap = new Map<string, ScoredPassage>();

    for (const row of results) {
      const passageId = row.passage_id as string;
      
      if (!passageMap.has(passageId)) {
        passageMap.set(passageId, {
          id: row.id as string,
          document_id: row.document_id as string,
          passage_index: row.passage_index as number,
          start_line: row.start_line as number,
          end_line: row.end_line as number,
          heading: row.heading as string | null,
          heading_level: row.heading_level as number | null,
          parent_section_id: row.parent_section_id as string | null,
          text: row.text as string,
          word_count: row.word_count as number,
          token_count: row.token_count as number,
          created_at: 0,
          score: 0
        });
      }

      const passage = passageMap.get(passageId)!;
      const tf = row.term_frequency as number;
      const idf = row.idf_score as number;
      const docLen = row.word_count as number;
      const positionWeight = row.position_weight as number;

      const norm = 1 - this.params.b + this.params.b * (docLen / avgDocLen);
      const baseScore = idf * ((tf * (this.params.k1 + 1)) / (tf + this.params.k1 * norm));
      
      // Apply rare term boost
      const rarityBoost = idf > this.params.rare_term_idf_threshold 
        ? this.params.rare_term_boost 
        : 1.0;
      
      // Apply position weight (heading vs body)
      const termScore = baseScore * rarityBoost * positionWeight;

      // Original query terms get full score, expanded terms get half
      const isQueryTerm = queryTerms.has(row.term as string);
      passage.score += isQueryTerm ? termScore : termScore * 0.5;
    }

    return Array.from(passageMap.values());
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i-1) === a.charAt(j-1)) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  async deleteDocumentIndex(documentId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM bm25_terms WHERE document_id = ?').bind(documentId),
      this.db.prepare('DELETE FROM bm25_stats WHERE document_id = ?').bind(documentId)
    ]);
  }
}
