import { GoogleGenAI } from '@google/genai';

export interface GeminiStreamChunk {
  type: 'thinking' | 'answer';
  content: string;
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  thinkingBudget?: number; // -1 = dynamic, 0 = disabled, >0 = specific budget
  includeThoughts?: boolean;
}

export class GeminiClient {
  private client: GoogleGenAI;
  private defaultModel: string;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.defaultModel = 'gemini-flash-latest';
  }

  /**
   * Stream content with optional thinking mode
   */
  async *streamContent(
    prompt: string,
    config: Partial<GeminiConfig> = {}
  ): AsyncGenerator<GeminiStreamChunk> {
    const generationConfig: any = {
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens ?? 2000,
    };

    // Add thinking config if specified
    if (config.thinkingBudget !== undefined || config.includeThoughts) {
      generationConfig.thinkingConfig = {
        thinkingBudget: config.thinkingBudget ?? -1,
        includeThoughts: config.includeThoughts ?? true,
      };
    }

    const response = await this.client.models.generateContentStream({
      model: config.model || this.defaultModel,
      contents: prompt,
      config: generationConfig,
    });

    for await (const chunk of response) {
      const candidate = chunk.candidates?.[0];
      if (!candidate?.content?.parts) continue;

      for (const part of candidate.content.parts) {
        if (!part.text) continue;

        // Check if this part is thinking/reasoning
        // Gemini uses 'thought' field or metadata to indicate thinking parts
        const isThinking = (part as any).thought === true || (part as any).metadata?.type === 'thinking';
        
        console.log('[DEBUG] Gemini chunk:', { 
          hasThought: (part as any).thought,
          metadata: (part as any).metadata,
          textPreview: part.text?.substring(0, 50)
        });

        if (isThinking) {
          yield { type: 'thinking', content: part.text };
        } else {
          yield { type: 'answer', content: part.text };
        }
      }
    }
  }

  /**
   * Generate content without streaming
   */
  async generateContent(
    prompt: string,
    config: Partial<GeminiConfig> = {}
  ): Promise<{ thinking?: string; answer: string }> {
    const generationConfig: any = {
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens ?? 2000,
    };

    if (config.thinkingBudget !== undefined || config.includeThoughts) {
      generationConfig.thinkingConfig = {
        thinkingBudget: config.thinkingBudget ?? -1,
        includeThoughts: config.includeThoughts ?? true,
      };
    }

    const response = await this.client.models.generateContent({
      model: config.model || this.defaultModel,
      contents: prompt,
      config: generationConfig,
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('No response from Gemini');
    }

    let thinking = '';
    let answer = '';

    for (const part of candidate.content.parts) {
      if (!part.text) continue;
      
      const isThinking = (part as any).thought === true || (part as any).metadata?.type === 'thinking';
      
      if (isThinking) {
        thinking += part.text;
      } else {
        answer += part.text;
      }
    }

    return { thinking: thinking || undefined, answer };
  }

  /**
   * Generate JSON content (for structured outputs like query analysis)
   */
  async generateJSON<T>(
    prompt: string,
    config: Partial<GeminiConfig> = {}
  ): Promise<T> {
    const generationConfig: any = {
      temperature: config.temperature ?? 0.3,
      maxOutputTokens: config.maxTokens ?? 1000,
      // Disable thinking for structured output tasks
      thinkingConfig: {
        thinkingBudget: 0,
      },
    };

    const response = await this.client.models.generateContent({
      model: config.model || this.defaultModel,
      contents: prompt,
      config: generationConfig,
    });

    const text = response.text || '';
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;
    
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${text}`);
    }
  }
}
