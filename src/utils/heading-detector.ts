import type { DetectedHeading, HeadingSignals } from '../types';

export class HeadingDetector {
  private readonly minHeadingScore = 5;
  private readonly maxHeadingLength = 120;
  
  // Words that indicate NOT a heading
  private readonly negativeIndicators = new Set([
    'note', 'important', 'warning', 'example', 'see', 'refer', 'also'
  ]);

  detectHeadings(lines: string[]): DetectedHeading[] {
    const headings: DetectedHeading[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length === 0) continue;
      
      const signals = this.analyzeSignals(line, lines[i + 1]);
      const score = this.calculateScore(signals, line);
      
      if (score >= this.minHeadingScore) {
        const level = this.determineLevel(line, signals);
        headings.push({
          text: line,
          line_number: i,
          level,
          score,
          signals
        });
      }
    }
    
    return headings;
  }

  private analyzeSignals(line: string, nextLine?: string): HeadingSignals {
    const isFollowedByBlank = !nextLine || nextLine.trim().length === 0;
    
    return {
      all_caps: this.isAllCaps(line),
      numbered: this.isNumbered(line),
      title_case: this.isTitleCase(line),
      short_length: line.length < this.maxHeadingLength,
      followed_by_blank: isFollowedByBlank,
      colon_ended: line.endsWith(':'),
      contains_section_marker: this.hasSectionMarker(line)
    };
  }

  private calculateScore(signals: HeadingSignals, line: string): number {
    let score = 0;
    
    // Positive signals
    if (signals.all_caps) score += 3;
    if (signals.numbered) score += 3;
    if (signals.title_case) score += 2;
    if (signals.short_length) score += 1;
    if (signals.followed_by_blank) score += 1;
    if (signals.colon_ended) score += 1;
    if (signals.contains_section_marker) score += 3;
    
    // Negative signals
    if (line.includes('?')) score -= 2;
    if (line.includes('!') && !signals.all_caps) score -= 1;
    
    const lowerLine = line.toLowerCase();
    for (const indicator of this.negativeIndicators) {
      if (lowerLine.includes(indicator)) {
        score -= 1;
        break;
      }
    }
    
    return score;
  }

  private isAllCaps(line: string): boolean {
    const letters = line.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return false;
    
    const upperCount = (line.match(/[A-Z]/g) || []).length;
    return upperCount / letters.length > 0.8;
  }

  private isNumbered(line: string): boolean {
    // Matches: "1.", "1.1", "1.1.1", "(1)", "A.", "A.1", etc.
    const patterns = [
      /^\d+\./,
      /^\d+\.\d+/,
      /^\d+\.\d+\.\d+/,
      /^\(\d+\)/,
      /^[A-Z]\./,
      /^[A-Z]\.\d+/,
      /^[ivxlcdm]+\./i  // Roman numerals
    ];
    
    return patterns.some(pattern => pattern.test(line.trim()));
  }

  private isTitleCase(line: string): boolean {
    const words = line.split(/\s+/);
    if (words.length === 0) return false;
    
    const articles = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const capitalizedWords = words.filter((word, idx) => {
      // First word should always be capitalized in title case
      if (idx === 0) return /^[A-Z]/.test(word);
      
      // Articles and short words can be lowercase
      if (articles.has(word.toLowerCase()) && word.length <= 3) return true;
      
      // Other words should be capitalized
      return /^[A-Z]/.test(word);
    });
    
    return capitalizedWords.length / words.length > 0.6;
  }

  private hasSectionMarker(line: string): boolean {
    const markers = [
      /^section\s+\d+/i,
      /^chapter\s+\d+/i,
      /^part\s+[a-z0-9]+/i,
      /^article\s+\d+/i,
      /^appendix\s+[a-z]/i
    ];
    
    return markers.some(pattern => pattern.test(line.trim()));
  }

  private determineLevel(line: string, signals: HeadingSignals): number {
    // Level 1: ALL_CAPS or top-level numbered (1., 2., etc.)
    if (signals.all_caps) return 1;
    if (/^\d+\.\s/.test(line)) return 1;
    if (signals.contains_section_marker) return 1;
    
    // Level 2: Two-part numbering (1.1, 1.2, etc.)
    if (/^\d+\.\d+\s/.test(line)) return 2;
    
    // Level 3: Three-part numbering (1.1.1, etc.)
    if (/^\d+\.\d+\.\d+\s/.test(line)) return 3;
    
    // Level 4: Anything else with lower signals
    if (signals.title_case) return 2;
    
    return 3;
  }

  // Build heading hierarchy for context expansion
  buildHierarchy(headings: DetectedHeading[]): Map<string, DetectedHeading[]> {
    const hierarchy = new Map<string, DetectedHeading[]>();
    const stack: DetectedHeading[] = [];
    
    for (const heading of headings) {
      // Pop stack until we find a heading with lower level
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }
      
      // Parent is the last heading in stack
      const parent = stack.length > 0 ? stack[stack.length - 1] : null;
      const parentKey = parent ? parent.text : 'root';
      
      if (!hierarchy.has(parentKey)) {
        hierarchy.set(parentKey, []);
      }
      hierarchy.get(parentKey)!.push(heading);
      
      stack.push(heading);
    }
    
    return hierarchy;
  }
}
