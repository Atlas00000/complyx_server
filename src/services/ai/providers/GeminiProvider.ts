import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, Message, ChatResponse, StreamChunk } from '../interfaces/AIProvider';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      const isRateLimit = 
        error?.status === 429 ||
        error?.code === 429 ||
        error?.message?.includes('429') ||
        error?.message?.toLowerCase().includes('quota') ||
        error?.message?.toLowerCase().includes('rate limit');

      // Only retry on rate limit errors
      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }

      // Log retry attempt
      console.warn(
        `⚠️  Gemini API rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})...`
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    // Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash
    // Using gemini-2.5-flash (faster, free tier) as default
    this.model = 'gemini-2.5-flash';
    
    // Only create client if API key is available
    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    } else {
      // Create a dummy client to avoid errors (will fail on actual API calls)
      this.client = new GoogleGenerativeAI('');
    }
    
    // Debug logging
    if (!this.apiKey) {
      console.warn('⚠️  GeminiProvider: GEMINI_API_KEY is not set');
    }
  }

  getName(): string {
    return 'gemini';
  }

  getModel(): string {
    return this.model;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async chat(messages: Message[]): Promise<ChatResponse> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured');
    }

    return retryWithBackoff(async () => {
      const model = this.client.getGenerativeModel({ model: this.model });
      
      // Convert messages to Gemini format
      const formattedMessages = this.formatMessages(messages);
      
      try {
        const result = await model.generateContent(formattedMessages);
        const response = await result.response;
        const text = response.text();

        return {
          content: text,
          model: this.model,
          usage: {
            // Gemini doesn't provide detailed usage in free tier
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
          },
        };
      } catch (error: any) {
        // Enhance error message for rate limits
        if (
          error?.status === 429 ||
          error?.code === 429 ||
          error?.message?.includes('429') ||
          error?.message?.toLowerCase().includes('quota') ||
          error?.message?.toLowerCase().includes('rate limit')
        ) {
          throw new Error(
            'Rate limit exceeded: You have exceeded your Gemini API quota. ' +
            'Please check your plan and billing details at https://ai.google.dev/gemini-api/docs/rate-limits. ' +
            'The system will automatically retry, but you may need to upgrade your plan or wait for the quota to reset.'
          );
        }
        throw error;
      }
    }, {
      maxRetries: 3,
      initialDelay: 2000, // Start with 2 seconds
      maxDelay: 30000, // Max 30 seconds
      backoffMultiplier: 2,
    });
  }

  async *streamChat(messages: Message[]): AsyncIterable<StreamChunk> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      const formattedMessages = this.formatMessages(messages);
      
      const stream = await model.generateContentStream(formattedMessages);

      for await (const chunk of stream.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            content: text,
            done: false,
          };
        }
      }

      yield {
        content: '',
        done: true,
      };
    } catch (error: any) {
      // Handle rate limit errors for streaming
      if (
        error?.status === 429 ||
        error?.code === 429 ||
        error?.message?.includes('429') ||
        error?.message?.toLowerCase().includes('quota') ||
        error?.message?.toLowerCase().includes('rate limit')
      ) {
        throw new Error(
          'Rate limit exceeded: You have exceeded your Gemini API quota. ' +
          'Please check your plan and billing details at https://ai.google.dev/gemini-api/docs/rate-limits. ' +
          'Streaming requests cannot be automatically retried. Please try again in a few moments.'
        );
      }
      throw error;
    }
  }

  private formatMessages(messages: Message[]): string {
    // Gemini uses a single string format, so we combine messages
    // System messages are prepended, user and assistant messages are formatted
    const parts: string[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        parts.push(`System: ${message.content}\n\n`);
      } else if (message.role === 'user') {
        parts.push(`User: ${message.content}\n\n`);
      } else if (message.role === 'assistant') {
        parts.push(`Assistant: ${message.content}\n\n`);
      }
    }
    
    return parts.join('');
  }
}
