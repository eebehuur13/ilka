import type { ChunkBoundary, DetectedHeading } from '../types';
import { HeadingDetector } from './heading-detector';
import { countTokens, countWords } from './tokenizer';

export class HierarchicalChunker {
  private readonly maxTokens = 5000;
  private readonly minTokens = 10;  // Lowered to allow short documents
  private headingDetector: HeadingDetector;
  
  constructor() {
    this.headingDetector = new HeadingDetector();
  }

  chunk(text: string): ChunkBoundary[] {
    const lines = text.split('\n');
    const headings = this.headingDetector.detectHeadings(lines);
    
    if (headings.length === 0) {
      // No headings detected, split by paragraph with token limit
      return this.chunkByParagraphs(lines);
    }
    
    // Chunk by heading boundaries
    return this.chunkByHeadings(lines, headings);
  }

  private chunkByHeadings(lines: string[], headings: DetectedHeading[]): ChunkBoundary[] {
    const chunks: ChunkBoundary[] = [];
    
    // Add sentinels for first and last chunks
    const allBoundaries = [
      { line_number: 0, level: 0, text: null },
      ...headings,
      { line_number: lines.length, level: 0, text: null }
    ];
    
    for (let i = 0; i < allBoundaries.length - 1; i++) {
      const start = allBoundaries[i].line_number;
      const end = allBoundaries[i + 1].line_number;
      const heading = allBoundaries[i].text;
      const headingLevel = allBoundaries[i].level || null;
      
      const sectionText = lines.slice(start, end).join('\n').trim();
      if (!sectionText) continue;
      
      const tokens = countTokens(sectionText);
      
      if (tokens <= this.maxTokens) {
        // Section fits in one chunk
        chunks.push({
          start_line: start,
          end_line: end - 1,
          heading,
          heading_level: headingLevel,
          parent_section_id: this.findParentSection(headings, start, headingLevel),
          text: sectionText,
          word_count: countWords(sectionText),
          token_count: tokens
        });
      } else {
        // Section too large, split it
        const subChunks = this.splitLargeSection(
          lines.slice(start, end),
          start,
          heading,
          headingLevel,
          headings
        );
        chunks.push(...subChunks);
      }
    }

    // Filter out very short chunks, BUT keep them if that's all we have
    const filtered = chunks.filter(c => c.token_count >= this.minTokens);
    if (filtered.length === 0 && chunks.length > 0) {
      // Document only has short chunks - keep them all to avoid losing the document
      return chunks;
    }
    return filtered;
  }

  private splitLargeSection(
    sectionLines: string[],
    startLine: number,
    heading: string | null,
    headingLevel: number | null,
    allHeadings: DetectedHeading[]
  ): ChunkBoundary[] {
    const chunks: ChunkBoundary[] = [];
    
    // Look for sub-headings within this section
    const subHeadings = this.headingDetector.detectHeadings(sectionLines)
      .filter(h => headingLevel === null || h.level > headingLevel);
    
    if (subHeadings.length > 0) {
      // Split by sub-headings
      for (let i = 0; i < subHeadings.length; i++) {
        const subStart = i === 0 ? 0 : subHeadings[i].line_number;
        const subEnd = i < subHeadings.length - 1 
          ? subHeadings[i + 1].line_number 
          : sectionLines.length;
        
        const text = sectionLines.slice(subStart, subEnd).join('\n').trim();
        const tokens = countTokens(text);
        
        if (tokens <= this.maxTokens) {
          chunks.push({
            start_line: startLine + subStart,
            end_line: startLine + subEnd - 1,
            heading: subHeadings[i].text,
            heading_level: subHeadings[i].level,
            parent_section_id: heading,
            text,
            word_count: countWords(text),
            token_count: tokens
          });
        } else {
          // Still too large, split by paragraph
          const paraChunks = this.splitByParagraphBoundaries(
            sectionLines.slice(subStart, subEnd),
            startLine + subStart,
            subHeadings[i].text,
            subHeadings[i].level
          );
          chunks.push(...paraChunks);
        }
      }
    } else {
      // No sub-headings, split by paragraph boundaries
      chunks.push(...this.splitByParagraphBoundaries(
        sectionLines,
        startLine,
        heading,
        headingLevel
      ));
    }
    
    return chunks;
  }

  private splitByParagraphBoundaries(
    lines: string[],
    startLine: number,
    heading: string | null,
    headingLevel: number | null
  ): ChunkBoundary[] {
    const chunks: ChunkBoundary[] = [];
    let currentChunk: string[] = [];
    let chunkStartLine = startLine;
    let currentTokens = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = countTokens(line);
      
      // Check if adding this line would exceed limit
      if (currentTokens + lineTokens > this.maxTokens && currentChunk.length > 0) {
        // Finalize current chunk
        const text = currentChunk.join('\n').trim();
        if (text) {
          chunks.push({
            start_line: chunkStartLine,
            end_line: startLine + i - 1,
            heading,
            heading_level: headingLevel,
            parent_section_id: heading,
            text,
            word_count: countWords(text),
            token_count: currentTokens
          });
        }
        
        // Start new chunk
        currentChunk = [line];
        chunkStartLine = startLine + i;
        currentTokens = lineTokens;
      } else {
        currentChunk.push(line);
        currentTokens += lineTokens;
      }
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      const text = currentChunk.join('\n').trim();
      if (text) {
        chunks.push({
          start_line: chunkStartLine,
          end_line: startLine + lines.length - 1,
          heading,
          heading_level: headingLevel,
          parent_section_id: heading,
          text,
          word_count: countWords(text),
          token_count: currentTokens
        });
      }
    }
    
    return chunks;
  }

  private chunkByParagraphs(lines: string[]): ChunkBoundary[] {
    const chunks: ChunkBoundary[] = [];
    let currentChunk: string[] = [];
    let startLine = 0;
    let currentTokens = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = countTokens(line);
      
      if (currentTokens + lineTokens > this.maxTokens && currentChunk.length > 0) {
        const text = currentChunk.join('\n').trim();
        if (text) {
          chunks.push({
            start_line: startLine,
            end_line: i - 1,
            heading: null,
            heading_level: null,
            parent_section_id: null,
            text,
            word_count: countWords(text),
            token_count: currentTokens
          });
        }
        
        currentChunk = [line];
        startLine = i;
        currentTokens = lineTokens;
      } else {
        currentChunk.push(line);
        currentTokens += lineTokens;
      }
    }
    
    if (currentChunk.length > 0) {
      const text = currentChunk.join('\n').trim();
      if (text) {
        chunks.push({
          start_line: startLine,
          end_line: lines.length - 1,
          heading: null,
          heading_level: null,
          parent_section_id: null,
          text,
          word_count: countWords(text),
          token_count: currentTokens
        });
      }
    }
    
    return chunks;
  }

  private findParentSection(
    headings: DetectedHeading[],
    lineNumber: number,
    currentLevel: number | null
  ): string | null {
    if (!currentLevel) return null;
    
    // Find the nearest heading before this line with a lower level
    for (let i = headings.length - 1; i >= 0; i--) {
      if (headings[i].line_number < lineNumber && headings[i].level < currentLevel) {
        return headings[i].text;
      }
    }
    
    return null;
  }
}
