// Simple token counting approximation
// OpenAI-style: ~1.3 tokens per word on average
// For more accuracy, we could use tiktoken, but this is close enough

export function countTokens(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const tokens = countTokens(text);
  if (tokens <= maxTokens) return text;
  
  const words = text.split(/\s+/);
  const targetWords = Math.floor(maxTokens / 1.3);
  return words.slice(0, targetWords).join(' ') + '...';
}
