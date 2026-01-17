import { ProviderFactory } from './ProviderFactory';
import type { AIProvider, Message, ChatResponse, StreamChunk } from './interfaces/AIProvider';

export class AIService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || ProviderFactory.create();
  }

  /**
   * Send a chat message and get a response
   */
  async chat(messages: Message[]): Promise<ChatResponse> {
    if (!this.provider.isAvailable()) {
      throw new Error(`AI provider ${this.provider.getName()} is not configured`);
    }

    try {
      return await this.provider.chat(messages);
    } catch (error) {
      throw new Error(`AI chat error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a chat message and get a streaming response
   */
  async *streamChat(messages: Message[]): AsyncIterable<StreamChunk> {
    if (!this.provider.isAvailable()) {
      throw new Error(`AI provider ${this.provider.getName()} is not configured`);
    }

    try {
      yield* this.provider.streamChat(messages);
    } catch (error) {
      throw new Error(`AI streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current provider name
   */
  getProviderName(): string {
    return this.provider.getName();
  }

  /**
   * Get the current model name
   */
  getModel(): string {
    return this.provider.getModel();
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return this.provider.isAvailable();
  }
}
