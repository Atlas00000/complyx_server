import type { AIProvider } from './interfaces/AIProvider';
import { GeminiProvider } from './providers/GeminiProvider';

export class ProviderFactory {
  /**
   * Create an AI provider based on environment configuration
   */
  static create(): AIProvider {
    const providerName = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

    switch (providerName) {
      case 'gemini':
        return new GeminiProvider();
      
      // Future providers will be added here
      // case 'grok':
      //   return new GrokProvider();
      // case 'openai':
      //   return new OpenAIProvider();
      
      default:
        console.warn(`Unknown provider: ${providerName}, defaulting to gemini`);
        return new GeminiProvider();
    }
  }

  /**
   * Get the configured provider name
   */
  static getProviderName(): string {
    return (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  }

  /**
   * Check if a provider is available
   */
  static isProviderAvailable(_providerName: string): boolean {
    const provider = this.create();
    return provider.isAvailable();
  }
}
