import { ProviderFactory } from './ProviderFactory';
import type { AIProvider, Message, ChatResponse, StreamChunk } from './interfaces/AIProvider';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FactCheckResult {
  factChecked: boolean;
  confidence: number; // 0-1
  issues?: string[];
  sources?: string[];
}

export interface EnhancedChatResponse extends ChatResponse {
  confidence?: number; // Overall confidence score (0-1)
  validation?: ValidationResult;
  factCheck?: FactCheckResult;
}

export class AIService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || ProviderFactory.create();
  }

  /**
   * Send a chat message and get a response with validation and confidence scoring
   */
  async chat(messages: Message[]): Promise<EnhancedChatResponse> {
    if (!this.provider.isAvailable()) {
      throw new Error(`AI provider ${this.provider.getName()} is not configured`);
    }

    try {
      const response = await this.provider.chat(messages);

      // Validate response
      const validation = this.validateResponse(response);

      // Fact-check response (basic implementation)
      const factCheck = await this.factCheckResponse(response, messages);

      // Calculate confidence score
      const confidence = this.calculateConfidence(validation, factCheck, response);

      return {
        ...response,
        confidence,
        validation,
        factCheck,
      };
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

  /**
   * Validate AI response
   */
  private validateResponse(response: ChatResponse): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if response has content
    if (!response.content || response.content.trim().length === 0) {
      errors.push('Response is empty');
    }

    // Check response length (too short might indicate an error)
    if (response.content && response.content.trim().length < 10) {
      warnings.push('Response is very short, may be incomplete');
    }

    // Check for common error patterns
    const errorPatterns = [
      /i'm sorry/i,
      /i cannot/i,
      /i don't have access/i,
      /i'm unable/i,
      /error occurred/i,
    ];

    if (response.content) {
      for (const pattern of errorPatterns) {
        if (pattern.test(response.content)) {
          warnings.push('Response may indicate an error or limitation');
          break;
        }
      }
    }

    // Check for IFRS-related keywords (for IFRS-specific queries)
    // This is a basic check - in production, you'd check against the original query
    const ifrsKeywords = ['IFRS', 'S1', 'S2', 'standard', 'compliance'];
    // Check for IFRS keywords in response (for validation)
    ifrsKeywords.some(keyword => 
      response.content!.toLowerCase().includes(keyword.toLowerCase())
    );

    // Warn if response doesn't contain expected keywords (basic heuristic)
    // This is simplified - in production, you'd analyze the query context

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Fact-check AI response (basic implementation)
   * In production, this could cross-reference with knowledge base or trusted sources
   */
  private async factCheckResponse(
    response: ChatResponse,
    messages: Message[]
  ): Promise<FactCheckResult> {
    // Basic fact-checking heuristics
    // In production, this would:
    // 1. Extract factual claims from the response
    // 2. Cross-reference with knowledge base
    // 3. Check against trusted sources
    // 4. Verify IFRS standard references

    const content = response.content || '';
    
    // Check for IFRS standard references
    const ifrsStandardPattern = /IFRS\s*S?[0-9]+/gi;
    const hasIFRSReferences = ifrsStandardPattern.test(content);

    // Check for citations or references
    const citationPatterns = [
      /section\s+\d+/i,
      /paragraph\s+\d+/i,
      /according to/i,
      /per IFRS/i,
      /standard\s+requires/i,
    ];

    const hasCitations = citationPatterns.some(pattern => pattern.test(content));

    // Basic confidence calculation
    let confidence = 0.7; // Base confidence

    // Increase confidence if has IFRS references
    if (hasIFRSReferences) {
      confidence += 0.1;
    }

    // Increase confidence if has citations
    if (hasCitations) {
      confidence += 0.1;
    }

    // Check for hedging language (may reduce confidence)
    const hedgingPatterns = [
      /might/i,
      /could/i,
      /possibly/i,
      /maybe/i,
      /not sure/i,
      /uncertain/i,
    ];

    const hasHedging = hedgingPatterns.some(pattern => pattern.test(content));
    if (hasHedging) {
      confidence -= 0.1;
    }

    // Clamp confidence to 0-1
    confidence = Math.max(0, Math.min(1, confidence));

    const issues: string[] = [];
    
    // Flag potential issues
    if (!hasIFRSReferences && this.isIFRSQuery(messages)) {
      issues.push('Response may lack specific IFRS standard references');
    }

    if (!hasCitations) {
      issues.push('Response may lack citations or references');
    }

    return {
      factChecked: true,
      confidence,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Check if query is IFRS-related (basic heuristic)
   */
  private isIFRSQuery(messages: Message[]): boolean {
    const conversationText = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();

    const ifrsKeywords = ['ifrs', 's1', 's2', 'standard', 'compliance', 'sustainability', 'climate'];
    return ifrsKeywords.some(keyword => conversationText.includes(keyword));
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    validation: ValidationResult,
    factCheck: FactCheckResult,
    response: ChatResponse
  ): number {
    // Start with fact-check confidence
    let confidence = factCheck.confidence;

    // Reduce confidence if validation errors exist
    if (!validation.valid) {
      confidence -= 0.3;
    }

    // Reduce confidence if warnings exist
    if (validation.warnings.length > 0) {
      confidence -= validation.warnings.length * 0.05;
    }

    // Adjust based on response length (very short responses may be less reliable)
    if (response.content) {
      const contentLength = response.content.trim().length;
      if (contentLength < 50) {
        confidence -= 0.1;
      } else if (contentLength > 500) {
        confidence += 0.05; // Longer responses often more comprehensive
      }
    }

    // Clamp confidence to 0-1
    confidence = Math.max(0, Math.min(1, confidence));

    return confidence;
  }

  /**
   * Send a chat message without validation (for backward compatibility)
   */
  async chatWithoutValidation(messages: Message[]): Promise<ChatResponse> {
    if (!this.provider.isAvailable()) {
      throw new Error(`AI provider ${this.provider.getName()} is not configured`);
    }

    try {
      return await this.provider.chat(messages);
    } catch (error) {
      throw new Error(`AI chat error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
