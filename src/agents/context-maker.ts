import type { Env, ScoredPassage, WideningStrategy } from '../types';

export class ContextMakerAgent {
  constructor(private readonly env: Env) {}

  async widen(
    passages: ScoredPassage[],
    strategy: WideningStrategy
  ): Promise<ScoredPassage[]> {
    if (strategy === 'heading-bounded') {
      return await this.expandToSection(passages);
    }

    if (strategy === 'sliding-window') {
      return await this.expandWithWindow(passages);
    }

    if (strategy === 'full-section') {
      return await this.expandToFullSection(passages);
    }

    return passages;
  }

  private async expandToSection(passages: ScoredPassage[]): Promise<ScoredPassage[]> {
    const expanded: ScoredPassage[] = [];
    const processedSections = new Set<string>();

    for (const passage of passages) {
      const sectionKey = passage.parent_section_id || passage.heading || passage.id;
      
      if (processedSections.has(sectionKey)) continue;
      processedSections.add(sectionKey);

      const sectionPassages = await this.getSectionPassages(
        passage.document_id,
        passage.parent_section_id || passage.heading
      );

      // Guard against empty section - use original passage if no section found
      if (sectionPassages.length === 0) {
        expanded.push(passage);
        continue;
      }

      // Limit to max 5 passages to keep context focused
      const limitedPassages = sectionPassages.slice(0, 5);
      const mergedText = limitedPassages.map(p => p.text).join('\n\n');
      
      expanded.push({
        ...passage,
        text: mergedText,
        start_line: Math.min(...limitedPassages.map(p => p.start_line)),
        end_line: Math.max(...limitedPassages.map(p => p.end_line)),
        word_count: limitedPassages.reduce((sum, p) => sum + p.word_count, 0),
        token_count: limitedPassages.reduce((sum, p) => sum + p.token_count, 0)
      });
    }

    return expanded.slice(0, 20);
  }

  private async expandWithWindow(passages: ScoredPassage[]): Promise<ScoredPassage[]> {
    const expanded: ScoredPassage[] = [];

    for (const passage of passages) {
      const neighbors = await this.getNeighborPassages(
        passage.document_id,
        passage.passage_index,
        1
      );

      const allPassages = [passage, ...neighbors].sort((a, b) => a.passage_index - b.passage_index);
      
      // Guard against empty neighbors - use original passage if alone
      if (allPassages.length === 0) {
        expanded.push(passage);
        continue;
      }
      
      const mergedText = allPassages.map(p => p.text).join('\n\n');

      expanded.push({
        ...passage,
        text: mergedText,
        start_line: Math.min(...allPassages.map(p => p.start_line)),
        end_line: Math.max(...allPassages.map(p => p.end_line)),
        word_count: allPassages.reduce((sum, p) => sum + p.word_count, 0),
        token_count: allPassages.reduce((sum, p) => sum + p.token_count, 0)
      });
    }

    return expanded;
  }

  private async expandToFullSection(passages: ScoredPassage[]): Promise<ScoredPassage[]> {
    const expanded: ScoredPassage[] = [];
    const processedSections = new Set<string>();

    for (const passage of passages) {
      // Use actual section heading, not entire document
      const sectionKey = `${passage.document_id}:${passage.parent_section_id || passage.heading || 'no-section'}`;
      
      if (processedSections.has(sectionKey)) continue;
      processedSections.add(sectionKey);

      // Get passages from SAME SECTION only, not entire document
      const sectionPassages = passage.parent_section_id || passage.heading
        ? await this.getSectionPassages(passage.document_id, passage.parent_section_id || passage.heading)
        : [passage];

      if (sectionPassages.length === 0) {
        expanded.push(passage);
        continue;
      }

      // Limit to max 5 passages to prevent overwhelming writer with noise
      const limitedPassages = sectionPassages.slice(0, 5);
      const mergedText = limitedPassages.map(p => p.text).join('\n\n');
      
      expanded.push({
        ...passage,
        text: mergedText,
        start_line: Math.min(...limitedPassages.map(p => p.start_line)),
        end_line: Math.max(...limitedPassages.map(p => p.end_line)),
        word_count: limitedPassages.reduce((sum, p) => sum + p.word_count, 0),
        token_count: limitedPassages.reduce((sum, p) => sum + p.token_count, 0)
      });
    }

    return expanded.slice(0, 20);
  }

  private async getSectionPassages(
    documentId: string,
    sectionHeading: string | null
  ): Promise<ScoredPassage[]> {
    if (!sectionHeading) {
      return [];
    }

    const result = await this.env.DB
      .prepare(`
        SELECT * FROM passages 
        WHERE document_id = ? AND (parent_section_id = ? OR heading = ?)
        ORDER BY passage_index
      `)
      .bind(documentId, sectionHeading, sectionHeading)
      .all();

    return (result.results || []) as any as ScoredPassage[];
  }

  private async getNeighborPassages(
    documentId: string,
    passageIndex: number,
    window: number
  ): Promise<ScoredPassage[]> {
    const result = await this.env.DB
      .prepare(`
        SELECT * FROM passages 
        WHERE document_id = ? AND passage_index BETWEEN ? AND ?
        ORDER BY passage_index
      `)
      .bind(documentId, passageIndex - window, passageIndex + window)
      .all();

    return (result.results || []).filter(p => (p as any).passage_index !== passageIndex) as any as ScoredPassage[];
  }

  private async getAllDocumentPassages(documentId: string): Promise<ScoredPassage[]> {
    const result = await this.env.DB
      .prepare(`
        SELECT * FROM passages 
        WHERE document_id = ?
        ORDER BY passage_index
      `)
      .bind(documentId)
      .all();

    return (result.results || []) as any as ScoredPassage[];
  }
}
