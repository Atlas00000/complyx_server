import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, Message, ChatResponse, StreamChunk } from '../interfaces/AIProvider';

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

    const model = this.client.getGenerativeModel({ model: this.model });
    
    // Convert messages to Gemini format
    const formattedMessages = this.formatMessages(messages);
    
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
  }

  async *streamChat(messages: Message[]): AsyncIterable<StreamChunk> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured');
    }

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
